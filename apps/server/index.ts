/* eslint-disable @typescript-eslint/ban-ts-comment */
import express from 'express'
import logger from '@example/logger'
import { MongoClient, ObjectId } from 'mongodb'
import {
  generateAuthenticationOptions,
  GenerateAuthenticationOptionsOpts,
  generateRegistrationOptions,
  GenerateRegistrationOptionsOpts,
  VerifiedRegistrationResponse,
  verifyRegistrationResponse,
  VerifyRegistrationResponseOpts,
} from '@simplewebauthn/server'
import cors from 'cors'
import crypto from 'node:crypto'

// Set the global crypto object to the node-webcrypto-ossl implementation
// @ts-ignore
global.crypto = crypto

const uri = 'mongodb://root:root@localhost:27017'

const client = new MongoClient(uri)
const db = client.db('test')

const hmacSalt = 'myhmacsalt'

type Authenticator = Required<VerifiedRegistrationResponse>['registrationInfo']

const userCollection = db.collection<{
  _id: ObjectId
  username: string
  displayName: string
  authenticators: Authenticator[]
}>('users')

const challengeCollection = db.collection<{
  challenge: string
  used: boolean
}>('challenge')

const app = express()

// Enable JSON parsing for incoming requests
app.use(express.json())
// Enable CORS for all origins
app.use(cors())

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.post('/generate-registration-options', async (req, res) => {
  try {
    const { username, displayName } = req.body

    if (await userCollection.findOne({ username })) {
      throw new Error('User already exists')
    }

    await userCollection.insertOne({
      _id: new ObjectId(),
      username,
      displayName,
      authenticators: [],
    })
    const user = await userCollection.findOne({ username })

    // eslint-disable-next-line no-underscore-dangle
    const userID = user ? user._id.toString() : new ObjectId().toString()
    const userIDUint8Array = Uint8Array.from(Buffer.from(userID, 'utf-8'))

    const opts: GenerateRegistrationOptionsOpts = {
      rpName: 'Example Corp',
      rpID: 'localhost',
      userID: userIDUint8Array,
      userName: username,
      userDisplayName: displayName,
      attestationType: 'none',
      authenticatorSelection: {
        userVerification: 'required',
      },
      extensions: {
        hmacCreateSecret: true,
        // @ts-ignore
        prf: {
          eval: {
            first: hmacSalt,
          },
        },
      },
    }

    const options = await generateRegistrationOptions(opts)
    console.log(options.challenge)

    challengeCollection.insertOne({
      challenge: options.challenge,
      used: false,
    })

    res.json(options)
  } catch (e) {
    logger.error('Error generating registration options', e)
    res.status(500).send({ message: 'Internal Server Error' })
  }
})

app.post('/verify-registration', async (req, res) => {
  try {
    const { username, attestationResponse } = req.body

    const user = await userCollection.findOne({ username })

    if (!user) {
      res.status(400).send({ message: 'User not found' })

      return
    }

    const clientDataJSON = Buffer.from(
      attestationResponse.response.clientDataJSON,
      'base64'
    ).toString('utf-8')
    const clientData = JSON.parse(clientDataJSON)

    // const expectedChallenge = Uint8Array.from(
    //   Buffer.from(clientData.challenge, 'base64')
    // )
    console.log(clientData.challenge)

    const challenge = await challengeCollection.findOneAndUpdate(
      {
        challenge: clientData.challenge,
        used: false,
      },
      {
        $set: { used: true },
      }
    )

    if (!challenge) {
      res.status(400).send({
        message: 'Invalid challenge. Either does not exist or is already used.',
      })

      return
    }

    const opts: VerifyRegistrationResponseOpts = {
      response: attestationResponse,
      expectedChallenge: challenge.challenge,
      expectedOrigin: 'http://localhost:3000',
      expectedRPID: 'localhost',
    }

    try {
      const verification = await verifyRegistrationResponse(opts)

      if (verification.verified && verification.registrationInfo) {
        await userCollection.updateOne(
          { username },
          { $set: { authenticators: [verification.registrationInfo] } }
        )
        res.status(200).send({ message: 'Registration successful' })
      } else {
        res.status(400).send({ message: 'Registration failed' })
      }
    } catch (error) {
      logger.error('Error verifying registration', error)
      res.status(500).send({ message: 'Internal Server Error' })
    }
  } catch (e) {
    logger.error('Error verifying registration', e)
    res.status(500).send({ message: 'Internal Server Error' })
  }
})

app.post('/get-challange', async (req, res) => {
  try {
    const { username, userVerification, usePrfExtension } = req.body

    const user = await userCollection.findOne({ username })

    if (!user) {
      res.status(400).send({ message: `User not found: ${username}` })

      return
    }

    const opts: GenerateAuthenticationOptionsOpts = {
      rpID: 'localhost',
      allowCredentials: user.authenticators.map((a) => {
        return {
          id: a.credentialID,
        }
      }),
      userVerification: userVerification ? 'required' : 'discouraged',
      extensions: {
        // @ts-ignore
        hmacGetSecret: {
          salt1: hmacSalt,
        },
      },
    }

    if (usePrfExtension) {
      opts.extensions = {
        ...opts.extensions,
        // @ts-ignore
        prf: {
          eval: {
            first: hmacSalt,
          },
        },
      }
    }

    const options = await generateAuthenticationOptions(opts)

    await challengeCollection.insertOne({
      challenge: options.challenge,
      used: false,
    })

    res.json(options)
  } catch (e) {
    logger.error('Error verifying registration', e)
    res.status(500).send({ message: 'Internal Server Error' })
  }
})

// Error-handling middleware
// @ts-ignore
app.use((err, req, res, next) => {
  logger.error('Internal Server Error', err)

  res.status(500).json({
    message: 'Internal Server Error',
    error: err.message,
    stack: err.stack,
  })
})

const PORT = process.env.PORT || 9999

app.listen(PORT, () => {
  logger.info(`Example app listening on port ${PORT}`)
})
