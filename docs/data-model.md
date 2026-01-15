# Data Model

Table: public.aexfy_admin_state
- id (text) primary key
- type (text)
- companies (jsonb)
- users (jsonb)
- meta (jsonb)
- updated_at (timestamptz)

Row: id = main
- companies: array of company objects
- users: array of user objects

Row: id = __meta__ and type = meta
- meta: object with auxiliary data

Company object (example)
- id: string (zone prefix + sequence, e.g. CT-0001)
- name: string
- rut: string
- giro: string
- activity_code: string
- email_tributario: string
- phone: string
- region: string
- city: string
- comuna: string
- address: string
- plan: string
- status: string (active, pending, blocked)
- owner_email: string
- seller_email: string
- modules: array of strings
- created_at: ISO string
- updated_at: ISO string

User object (example)
- id: string (local id or auth id)
- auth_id: string (auth.users id when available)
- email: string
- status: string (active, disabled)
- user_metadata: object
  - first_name
  - middle_name
  - last_name
  - mother_last_name
  - full_name
  - rut
  - company_id
  - company_name
  - company_code
  - user_type (staff or cliente)
  - roles: array of role strings
  - role: primary role
- created_at: ISO string
- updated_at: ISO string

Auth metadata mapping
- auth.users.user_metadata mirrors user_metadata above
- roles stored in user_metadata.roles (array)
- primary role stored in user_metadata.role

Meta object
- supportTemplates: array
- productLibrary: array
- productTemplates: array
- auditLog: array
- userRequests: array
- companyRequests: array
