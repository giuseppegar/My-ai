-- Marcatore pubblico non segreto; impedisce al BFF di usare per errore un'altra istanza.
-- Eseguire SOLO sul database nuovo dedicato a My ai.
\set instance_id `echo "$MYAI_INSTANCE_ID"`
CREATE TABLE public.myai_instance_identity (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  instance_id uuid NOT NULL UNIQUE,
  application text NOT NULL CHECK (application = 'my-ai')
);
INSERT INTO public.myai_instance_identity (instance_id, application) VALUES (:'instance_id'::uuid, 'my-ai');
ALTER TABLE public.myai_instance_identity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.myai_instance_identity FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION public.myai_instance_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT instance_id FROM public.myai_instance_identity WHERE singleton AND application = 'my-ai'; $$;
REVOKE ALL ON FUNCTION public.myai_instance_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.myai_instance_id() TO anon, authenticated, service_role;
