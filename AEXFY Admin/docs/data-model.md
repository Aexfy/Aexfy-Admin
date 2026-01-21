# Modelo de datos

Estado
- Modelo aplicado en el codigo actual. 👍

Tabla: public.aexfy_admin_state
- id (text) primary key
- type (text)
- companies (jsonb)
- users (jsonb)
- meta (jsonb)
- updated_at (timestamptz)

Fila: id = main
- companies: array de empresas
- users: array de usuarios

Fila: id = __meta__ y type = meta
- meta: objeto con datos auxiliares

Empresa (ejemplo)
- id: string (prefijo zona + secuencia, ej: CT-0001)
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
- modules: array de strings
- created_at: ISO string
- updated_at: ISO string

Usuario (ejemplo)
- id: string (id local o auth id)
- auth_id: string (auth.users id cuando esta disponible)
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
  - user_type (staff o cliente)
  - roles: array de roles
  - role: rol primario
- created_at: ISO string
- updated_at: ISO string

Mapping en Auth
- auth.users.user_metadata refleja user_metadata
- roles en user_metadata.roles
- rol primario en user_metadata.role

Meta
- supportTemplates: array
- productLibrary: array
- productTemplates: array
- auditLog: array
- userRequests: array
- companyRequests: array
