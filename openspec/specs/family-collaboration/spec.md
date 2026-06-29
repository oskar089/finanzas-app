# Family Collaboration Specification

## Purpose

Enable users to create family groups, invite members with role-based access, and manage group membership.

## Requirements

### Requirement: Create Family Group

The system MUST create a family group and assign the creator as ADMIN.

#### Scenario: Create group successfully

- GIVEN an authenticated user
- WHEN POST /api/family is called with name "Hernandez Family"
- THEN a group is created with the user as ADMIN
- AND the response includes the group id, name, and member list with the creator's role

### Requirement: Invite Members

The system MUST allow ADMIN or MEMBER role users to invite other users by userId.

#### Scenario: Admin invites member

- GIVEN an authenticated ADMIN user in a family group
- WHEN POST /api/family/:groupId/invite is called with userId of another registered user and role "MEMBER"
- THEN the invited user is added to the group with role MEMBER

#### Scenario: Invite non-existent user

- GIVEN an authenticated ADMIN user in a family group
- WHEN POST /api/family/:groupId/invite is called with non-existent userId
- THEN the API returns a 404 Not Found error

### Requirement: Manage Roles

The system MUST allow ADMIN users to change member roles. Valid roles are ADMIN, MEMBER, and VIEWER.

#### Scenario: Promote member to admin

- GIVEN a family group with an ADMIN user and a MEMBER user
- WHEN PUT /api/family/:groupId/members/:memberId/role is called with role "ADMIN"
- THEN the member's role is updated to ADMIN

#### Scenario: Viewer cannot change roles

- GIVEN a family group with a VIEWER role user
- WHEN that VIEWER calls PUT /api/family/:groupId/members/:memberId/role
- THEN the API returns a 403 Forbidden error

### Requirement: Remove Members

The system MUST allow ADMIN users to remove members from a family group.

#### Scenario: Admin removes member

- GIVEN a family group with an ADMIN user and a MEMBER user
- WHEN DELETE /api/family/:groupId/members/:memberId is called by the ADMIN
- THEN the member is removed from the group

#### Scenario: Remove last admin prevented

- GIVEN a family group with only one ADMIN user
- WHEN that ADMIN tries to remove themself via DELETE /api/family/:groupId/members/:memberId
- THEN the API returns a 400 Bad Request error with message "Cannot remove last admin"

### Requirement: Delete Family Group

The system MUST allow ADMIN users to delete a family group entirely.

#### Scenario: Admin deletes group

- GIVEN a family group with an ADMIN user
- WHEN DELETE /api/family/:groupId is called by the ADMIN
- THEN the group and all its memberships are permanently deleted

#### Scenario: Non-admin cannot delete

- GIVEN a family group with a MEMBER role user
- WHEN that MEMBER calls DELETE /api/family/:groupId
- THEN the API returns a 403 Forbidden error

#### Known Gap: Family Collaboration Frontend

All family group endpoints exist on the backend. The canonical frontend has NO family collaboration UI — no group management, invite flow, or role management screens.
