-- 1. Profiles table for clients (linked to auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- 2. Add user_id and assigned_professional_id to service_requests
ALTER TABLE public.service_requests
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN assigned_professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL;

CREATE INDEX idx_service_requests_user_id ON public.service_requests(user_id);
CREATE INDEX idx_service_requests_assigned_pro ON public.service_requests(assigned_professional_id);

-- Allow clients to view their own requests
CREATE POLICY "Users view own requests" ON public.service_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Allow clients to update their own requests (e.g., assign a professional, mark concluded)
CREATE POLICY "Users update own requests" ON public.service_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- 3. Ratings table
CREATE TABLE public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL UNIQUE REFERENCES public.service_requests(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ratings" ON public.ratings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users insert own ratings" ON public.ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own ratings" ON public.ratings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all ratings" ON public.ratings FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE INDEX idx_ratings_professional ON public.ratings(professional_id);

-- 4. Chat messages between client and assigned professional (admin proxy)
CREATE TABLE public.request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('cliente', 'profissional', 'admin')),
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.request_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_request_messages_request ON public.request_messages(service_request_id, created_at);

-- Client (owner of request) can read & write
CREATE POLICY "Client reads own request messages" ON public.request_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = request_messages.service_request_id AND sr.user_id = auth.uid()
    )
  );

CREATE POLICY "Client sends messages on own request" ON public.request_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_role = 'cliente'
    AND sender_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = service_request_id AND sr.user_id = auth.uid()
    )
  );

-- Admin can read & write everything
CREATE POLICY "Admins read all messages" ON public.request_messages
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins send messages" ON public.request_messages
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.request_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_requests;