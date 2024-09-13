/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/button-has-type */
import { useRouter } from 'next/router'
import { useState } from 'react'
import { startAuthentication } from '@simplewebauthn/browser'

// Convert a string to an ArrayBuffer for the hmacGetSecret extension input
const stringToArrayBuffer = (str: string): ArrayBuffer => {
  const encoder = new TextEncoder()

  return encoder.encode(str).buffer
}

function UserPage() {
  const router = useRouter()
  const { username } = router.query
  const [userVerification, setUserVerification] = useState(false)
  const [usePrfExtension, setUsePrfExtension] = useState(false)
  const [authResult, setAuthResult] = useState('')

  const handleGetChallenge = async () => {
    setAuthResult('')

    try {
      // Call the get-challenge API
      const response = await fetch('http://localhost:9999/get-challange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, userVerification, usePrfExtension }),
      })

      if (response.status !== 200) {
        throw new Error('Failed to get challenge')
      }
      const options = await response.json()

      // options = {
      //   ...options,
      //   extensions: {
      //     ...options.extensions,
      //     hmacGetSecret: {
      //       salt1: stringToArrayBuffer(
      //         options.extensions.hmacGetSecret.salt1.toString()
      //       ),
      //     },
      //     prf: {
      //       eval: {
      //         first: Buffer.from(options.extensions.prf.eval.first, 'base64'),
      //       },
      //     },
      //   },
      // }

      if (options.extensions.hmacGetSecret) {
        options.extensions.hmacGetSecret = {
          salt1: stringToArrayBuffer(
            options.extensions.hmacGetSecret.salt1.toString()
          ),
        }
      }

      if (options.extensions.prf) {
        options.extensions.prf = {
          eval: {
            first: Buffer.from(options.extensions.prf.eval.first, 'base64'),
          },
        }
      }
      console.log(options)
      // Use WebAuthn API to start authentication
      const authResponse = await startAuthentication(options)
      console.log(authResponse)

      // @ts-ignore
      if (authResponse.clientExtensionResults.prf) {
        // @ts-ignore
        authResponse.clientExtensionResults.prf = {
          results: {
            first: Buffer.from(
              // @ts-ignore
              authResponse.clientExtensionResults.prf.results.first
            ).toString('base64'),
          },
        }
      }

      // Set the authentication result
      setAuthResult(JSON.stringify(authResponse, null, 2))
    } catch (error) {
      console.error('Error during authentication:', error)
      setAuthResult(`Authentication failed, ${error}`)
    }
  }

  return (
    <div>
      <h1>Authenticate User: {username}</h1>
      <div>
        <label htmlFor="userVerification">User Verification:</label>
        <input
          id="userVerification"
          type="checkbox"
          checked={userVerification}
          onChange={(e) => setUserVerification(e.target.checked)}
        />
      </div>
      <div>
        <label htmlFor="usePrf">Request PRF Extension:</label>
        <input
          id="usePrf"
          type="checkbox"
          checked={usePrfExtension}
          onChange={(e) => setUsePrfExtension(e.target.checked)}
        />
      </div>
      <button onClick={handleGetChallenge}>Get Challenge</button>
      <div>
        <label htmlFor="authResult">Authentication Result:</label>
        <textarea
          id="authResult"
          value={authResult}
          readOnly
          rows={10}
          cols={50}
        />
      </div>
    </div>
  )
}

export default UserPage
