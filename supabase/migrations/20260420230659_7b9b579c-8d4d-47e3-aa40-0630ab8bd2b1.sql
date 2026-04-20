-- Tabela de profissionais
CREATE TABLE public.professionals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  neighborhood TEXT,
  years_experience INTEGER,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode se cadastrar
CREATE POLICY "Anyone can register as professional"
ON public.professionals
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Somente admins podem ver
CREATE POLICY "Admins can view all professionals"
ON public.professionals
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Somente admins podem atualizar
CREATE POLICY "Admins can update professionals"
ON public.professionals
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger de updated_at
CREATE TRIGGER update_professionals_updated_at
BEFORE UPDATE ON public.professionals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();