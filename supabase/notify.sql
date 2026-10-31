-- Email Martín on every waitlist signup (Resend via pg_net). Needs: pg_net enabled + vault secret 'resend_api_key'.
create or replace function public.notify_waitlist_signup() returns trigger
language plpgsql security definer set search_path = public, extensions, vault as $$
declare
  api_key text;
  total int;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if api_key is null then return new; end if;
  select count(*) into total from public.waitlist;
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'Yeyi avisos <martin@prospexia.cl>',
      'to', jsonb_build_array('martin.rodriguez@uc.cl'),
      'subject', format('Yeyi: nuevo registro #%s (%s.º básico)', total, new.curso),
      'text', format(E'Correo: %s\nCurso: %s.º básico\nAnuncio: %s\nCampaña: %s\nFuente: %s\nFecha: %s\n\nTotal en la lista: %s',
        new.email, new.curso, coalesce(new.utm_content, '(sin utm)'), coalesce(new.utm_campaign, '-'),
        coalesce(new.utm_source, '-'), to_char(new.created_at at time zone 'America/Santiago', 'DD-MM-YYYY HH24:MI'), total)
    )
  );
  return new;
exception when others then
  return new; -- a failed notice must never block a signup
end $$;

drop trigger if exists waitlist_notify on public.waitlist;
create trigger waitlist_notify after insert on public.waitlist
  for each row execute function public.notify_waitlist_signup();
