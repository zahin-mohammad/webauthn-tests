/* eslint-disable jsx-a11y/label-has-associated-control */
import { FormEventHandler, useState } from 'react'
import { useRouter } from 'next/router'
import { startRegistration } from '@simplewebauthn/browser'

// Convert a string to an ArrayBuffer for the hmacGetSecret extension input
const stringToArrayBuffer = (str: string): ArrayBuffer => {
  const encoder = new TextEncoder()

  return encoder.encode(str).buffer
}

function Signup() {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const router = useRouter()

  const handleSignup: FormEventHandler = async (e) => {
    e.preventDefault()
    console.log('Signing up...')

    // Call the generate-registration-options API
    const response = await fetch(
      'http://localhost:9999/generate-registration-options',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, displayName }),
      }
    )

    console.log('response', response)

    let options = await response.json()

    options = {
      ...options,
      extensions: {
        ...options.extensions,
        prf: {
          eval: {
            first: Buffer.from(options.extensions.prf.eval.first, 'base64'),
          },
        },
      },
    }
    console.log(options)
    const credential = await startRegistration(options)
    console.log(credential)

    // Send the credential response to the verify-registration API
    const verifyResponse = await fetch(
      'http://localhost:9999/verify-registration',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          attestationResponse: credential,
        }),
      }
    )
    console.log(verifyResponse)
    const verifyResult = await verifyResponse.json()

    if (verifyResult.message === 'Registration successful') {
      // Route to the test-challenge page
      router.push({
        pathname: '/test-challenge',
        query: { username },
      })
    } else {
      alert('Registration failed')
    }
  }

  return (
    <div>
      <h1>Sign Up</h1>
      <form onSubmit={handleSignup}>
        <div>
          <label htmlFor="username">Username:</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="displayName">Display Name:</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>
        <button type="submit">Sign Up</button>
      </form>
    </div>
  )
}

export default Signup
