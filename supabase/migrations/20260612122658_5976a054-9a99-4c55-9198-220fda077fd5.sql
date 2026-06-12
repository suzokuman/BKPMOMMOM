
-- Cleanup old model
DROP TABLE IF EXISTS public.calorie_items CASCADE;
DROP TABLE IF EXISTS public.protein_items CASCADE;
DROP TABLE IF EXISTS public.daily_calorie_goals CASCADE;
DROP TABLE IF EXISTS public.daily_protein_goals CASCADE;
DROP TABLE IF EXISTS public.medications CASCADE;

-- profile additions
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height_cm NUMERIC;

-- updated_at helper (idempotent)
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- 1) Nutrition goals (one per user)
CREATE TABLE public.nutrition_goals (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  target_kcal NUMERIC,
  target_carbs_g NUMERIC,
  target_fat_g NUMERIC,
  target_protein_g NUMERIC,
  target_fiber_g NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_goals TO authenticated;
GRANT ALL ON public.nutrition_goals TO service_role;
ALTER TABLE public.nutrition_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_goals" ON public.nutrition_goals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER tg_nutrition_goals_updated BEFORE UPDATE ON public.nutrition_goals
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2) Meal templates (persistent meals like "Jantar 20:00")
CREATE TABLE public.meal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  alert_time TIME,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_templates TO authenticated;
GRANT ALL ON public.meal_templates TO service_role;
ALTER TABLE public.meal_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_meal_t" ON public.meal_templates FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_meal_t_user ON public.meal_templates(user_id);

-- 3) Meal template items
CREATE TABLE public.meal_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.meal_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qty TEXT,
  kcal NUMERIC NOT NULL DEFAULT 0,
  carbs_g NUMERIC NOT NULL DEFAULT 0,
  fat_g NUMERIC NOT NULL DEFAULT 0,
  fiber_g NUMERIC NOT NULL DEFAULT 0,
  protein_g NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_template_items TO authenticated;
GRANT ALL ON public.meal_template_items TO service_role;
ALTER TABLE public.meal_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_meal_items" ON public.meal_template_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_meal_items_tpl ON public.meal_template_items(template_id);

-- 4) Meal checks (one per template per day)
CREATE TABLE public.meal_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.meal_templates(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_checks TO authenticated;
GRANT ALL ON public.meal_checks TO service_role;
ALTER TABLE public.meal_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_meal_checks" ON public.meal_checks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_meal_checks_user_date ON public.meal_checks(user_id, date);

-- 5) Medication templates
-- frequency: 'daily', 'weekly', 'h4','h6','h8','h10','h12','h14','h16','h18','h20','h22','custom'
CREATE TABLE public.medication_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dose_mg NUMERIC,
  dose_text TEXT,
  start_time TIME,
  frequency TEXT NOT NULL DEFAULT 'daily',
  custom_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_templates TO authenticated;
GRANT ALL ON public.medication_templates TO service_role;
ALTER TABLE public.medication_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_med_t" ON public.medication_templates FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_med_t_user ON public.medication_templates(user_id);

-- 6) Medication checks (one per scheduled dose per day)
CREATE TABLE public.medication_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.medication_templates(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  taken BOOLEAN NOT NULL DEFAULT false,
  taken_at TIMESTAMPTZ,
  UNIQUE (template_id, scheduled_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_checks TO authenticated;
GRANT ALL ON public.medication_checks TO service_role;
ALTER TABLE public.medication_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_med_checks" ON public.medication_checks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_med_checks_user_sched ON public.medication_checks(user_id, scheduled_at);

-- 7) Weekly diary
CREATE TABLE public.weekly_diary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  weight_kg NUMERIC,
  waist_cm NUMERIC,
  thigh_cm NUMERIC,
  arm_cm NUMERIC,
  imc NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_diary TO authenticated;
GRANT ALL ON public.weekly_diary TO service_role;
ALTER TABLE public.weekly_diary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_diary" ON public.weekly_diary FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER tg_diary_updated BEFORE UPDATE ON public.weekly_diary
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 8) Weekly diary photos
CREATE TABLE public.weekly_diary_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_id UUID NOT NULL REFERENCES public.weekly_diary(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_diary_photos TO authenticated;
GRANT ALL ON public.weekly_diary_photos TO service_role;
ALTER TABLE public.weekly_diary_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_diary_photos" ON public.weekly_diary_photos FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 9) Daily reports
CREATE TABLE public.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  payload JSONB NOT NULL,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, report_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_reports TO authenticated;
GRANT ALL ON public.daily_reports TO service_role;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_reports" ON public.daily_reports FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_reports_user_date ON public.daily_reports(user_id, report_date DESC);

-- 10) subscriptions extras (plan period + renewal flags)
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_period_months INT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

-- 11) notification_settings: daily email opt-in
ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS daily_report_email BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS report_email TEXT;
