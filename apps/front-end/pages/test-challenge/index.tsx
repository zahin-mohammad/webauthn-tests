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
        body: JSON.stringify({ username, userVerification }),
      })

      if (response.status !== 200) {
        throw new Error('Failed to get challenge')
      }
      let options = await response.json()

      options = {
        ...options,
        extensions: {
          hmacGetSecret: {
            salt1: stringToArrayBuffer(
              options.extensions.hmacGetSecret.salt1.toString()
            ),
          },
        },
      }
      console.log(options)
      // Use WebAuthn API to start authentication
      const authResponse = await startAuthentication(options)

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
