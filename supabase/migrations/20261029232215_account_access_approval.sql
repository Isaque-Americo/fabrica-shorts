create or replace function public.login_options(p_role text)
returns table(username text, display_name text, access_ready boolean)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    nullif(trim(d.data->>'username'), ''),
    coalesce(
      nullif(trim(d.data->>'store_name'), ''),
      nullif(trim(d.data->>'nome'), ''),
      nullif(trim(d.data->>'username'), '')
    ),
    coalesce(d.data->>'acessoStatus', 'ativo') = 'ativo'
    and exists (
      select 1
      from auth.users as u
      join public.user_profiles as p on p.user_id = u.id
      where lower(u.email) = lower(nullif(trim(d.data->>'username'), '') || '@fabrica.interno')
        and p.role = p_role
        and (
          (p_role = 'lojista' and nullif(trim(p.store_name), '') is not null)
          or (p_role = 'representante' and nullif(trim(p.rep_id), '') is not null)
        )
    )
  from public.docs as d
  where p_role in ('lojista', 'representante')
    and d.col = 'cadastros'
    and d.data->>'tipoCadastro' = p_role
    and nullif(trim(d.data->>'username'), '') is not null
  order by lower(coalesce(
    nullif(trim(d.data->>'store_name'), ''),
    nullif(trim(d.data->>'nome'), ''),
    nullif(trim(d.data->>'username'), '')
  ));
$function$;
