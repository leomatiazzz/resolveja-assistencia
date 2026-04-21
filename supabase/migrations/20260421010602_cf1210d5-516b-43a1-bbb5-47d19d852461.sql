-- Allow clients to view the professional assigned to their own service request
CREATE POLICY "Clients view assigned professional"
ON public.professionals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.service_requests sr
    WHERE sr.assigned_professional_id = professionals.id
      AND sr.user_id = auth.uid()
  )
);

-- Allow public read of approved professionals (chatbot suggestions, ratings display)
CREATE POLICY "Anyone can view approved professionals"
ON public.professionals
FOR SELECT
TO anon, authenticated
USING (status = 'aprovado');