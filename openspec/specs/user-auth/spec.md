# User Auth Specification

## Purpose

Handle user registration, login, profile management, and JWT-based session lifecycle for the SPA frontend and REST API.

## Requirements

### Requirement: Registration

The system MUST register a new user with name, email, and password within a Prisma $transaction, and set a JWT as an HttpOnly cookie.
(Previously: JWT returned in response body, no $transaction)

#### Scenario: Successful registration

- GIVEN a new user with valid name, email, and password
- WHEN POST /api/auth/register is called
- THEN a user record is created with hashed password
- AND a JWT (30-day expiry) is set as an HttpOnly cookie on the response
- AND the user record and seed data are created atomically within one database transaction

#### Scenario: Duplicate email

- GIVEN an existing user with the email "user@example.com"
- WHEN POST /api/auth/register is called with the same email
- THEN the API returns a 409 Conflict error with message "Email already in use"
- AND no partial data remains (transaction fully rolled back)

### Requirement: Login

The system MUST authenticate a user by email and password, set a short-lived JWT as an HttpOnly cookie, and return a refresh token.
(Previously: JWT returned in response body, no refresh token)

#### Scenario: Successful login

- GIVEN a registered user with email and correct password
- WHEN POST /api/auth/login is called with those credentials
- THEN a JWT (15-minute expiry) is set as an HttpOnly cookie
- AND a refresh token (7-day expiry) is returned in the response body

#### Scenario: Wrong password

- GIVEN a registered user with email "user@example.com"
- WHEN POST /api/auth/login is called with the correct email and wrong password
- THEN the API returns a 401 Unauthorized error with message "Invalid credentials"
- AND no cookies are set

### Requirement: Session Restore

The system MUST restore the current user session by validating the JWT from the HttpOnly cookie and support transparent refresh token rotation when the JWT expires.
(Previously: JWT read from Authorization header, no refresh)

#### Scenario: Valid token returns profile

- GIVEN an authenticated user with a valid unexpired JWT in an HttpOnly cookie
- WHEN GET /api/auth/me is called
- THEN the response returns user profile data (id, name, email, avatar)

#### Scenario: Expired token triggers refresh

- GIVEN an authenticated user with an expired JWT cookie but a valid refresh token
- WHEN GET /api/auth/me is called
- THEN the API rotates the refresh token and sets a new JWT cookie
- AND the profile data is returned

### Requirement: Refresh Token Rotation

The system MUST support refresh token rotation: each refresh request invalidates the old refresh token and issues a new one.

#### Scenario: Refresh valid token

- GIVEN a user with a valid refresh token
- WHEN POST /api/auth/refresh is called
- THEN the old refresh token is invalidated
- AND a new JWT cookie and new refresh token are issued

#### Scenario: Refresh with reused (stolen) token

- GIVEN a refresh token that was already rotated
- WHEN POST /api/auth/refresh is called with the old token
- THEN all refresh tokens for that user are invalidated (theft detection)

### Requirement: Profile Update

The system MUST allow authenticated users to update their name, email, and avatar.

#### Scenario: Successful profile update

- GIVEN an authenticated user
- WHEN PUT /api/auth/profile is called with new name and avatar URL
- THEN the user record is updated and the new profile is returned

#### Scenario: Email conflict on update

- GIVEN an authenticated user and another user with email "other@example.com"
- WHEN PUT /api/auth/profile is called with email "other@example.com"
- THEN the API returns a 409 Conflict error

### Requirement: Password Toggle (UI)

The frontend SHOULD provide a visibility toggle (eye icon) on password fields in registration and login forms.

#### Scenario: Toggle reveals password

- GIVEN a login form with a password field of type "password"
- WHEN the user clicks the eye icon
- THEN the input type changes to "text" and the password is visible

#### Scenario: Toggle hides password

- GIVEN a login form with visible password (type "text")
- WHEN the user clicks the eye icon again
- THEN the input type changes back to "password"
