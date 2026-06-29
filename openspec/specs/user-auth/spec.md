# User Auth Specification

## Purpose

Handle user registration, login, profile management, and JWT-based session lifecycle for the SPA frontend and REST API.

## Requirements

### Requirement: Registration

The system MUST register a new user with name, email, and password, and return a JWT.

#### Scenario: Successful registration

- GIVEN a new user with valid name, email, and password
- WHEN POST /api/auth/register is called
- THEN a user record is created with hashed password
- AND a JWT (30-day expiry) is returned in the response body

#### Scenario: Duplicate email

- GIVEN an existing user with the email "user@example.com"
- WHEN POST /api/auth/register is called with the same email
- THEN the API returns a 409 Conflict error with message "Email already in use"

### Requirement: Login

The system MUST authenticate a user by email and password and return a JWT.

#### Scenario: Successful login

- GIVEN a registered user with email and correct password
- WHEN POST /api/auth/login is called with those credentials
- THEN a JWT (30-day expiry) is returned

#### Scenario: Wrong password

- GIVEN a registered user with email "user@example.com"
- WHEN POST /api/auth/login is called with the correct email and wrong password
- THEN the API returns a 401 Unauthorized error with message "Invalid credentials"

### Requirement: Session Restore

The system MUST restore the current user session via JWT validation.

#### Scenario: Valid token returns profile

- GIVEN an authenticated user with a valid unexpired JWT
- WHEN GET /api/auth/me is called with the JWT in the Authorization header
- THEN the response returns user profile data (id, name, email, avatar)

#### Scenario: Expired token

- GIVEN an authenticated user with an expired JWT
- WHEN GET /api/auth/me is called
- THEN the API returns a 401 Unauthorized error with message "Token expired"
- AND the frontend redirects to the login page

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
