alter table public.user_profiles
  add column if not exists contact_email text,
  add column if not exists contact_whatsapp text;

update public.user_profiles as p
set
  contact_email = 'z2isaqueamerico@gmail.com',
  contact_whatsapp = '+5532988383046'
from auth.users as u
where p.user_id = u.id
  and p.role = 'admin'
  and lower(u.email) = 'isaque@fabrica.interno';

comment on column public.user_profiles.contact_email is
  'Administrative contact email for internal communication.';
comment on column public.user_profiles.contact_whatsapp is
  'Administrative WhatsApp contact in international E.164 format.';
