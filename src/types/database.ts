export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type AppRole = 'admin' | 'trainer' | 'nutritionist' | 'student'
export type PlanBillingPeriod = 'monthly' | 'months3' | 'months6' | 'annual'
export type PlanAssignmentPaymentStatus = 'pending' | 'paid' | 'overdue'

export interface StudentPlanAssignment {
  id: string
  student_id: string
  web_plan_slug: string | null
  plan_name_snapshot: string
  billing_period: PlanBillingPeriod
  start_date: string
  end_date: string
  payment_status: PlanAssignmentPaymentStatus
  assigned_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}
export type StudentLevel = 'inicial' | 'intermedio' | 'avanzado'
export type StudentStatus = 'activo' | 'inactivo' | 'pausado' | 'baja'
export type RoutineStatus = 'activa' | 'por_vencer' | 'vencida' | 'pausada' | 'cancelada'
export type PdfStatus = 'pendiente' | 'en_proceso' | 'generado' | 'enviado' | 'error'
export type QuestionStatus = 'recibida' | 'en_revision' | 'devuelta' | 'cerrada'
export type PaymentStatus = 'pendiente' | 'cobrado' | 'cancelado' | 'reembolsado'
export type IncomeStatus = 'pendiente' | 'cobrado' | 'cancelado'
export type ExpenseType = 'fijo' | 'variable'
export type PaymentMethod =
  | 'efectivo_debito'
  | 'efectivo_ars'
  | 'cuenta_dni'
  | 'tarjeta_credito'
  | 'transferencia'
  | 'otro'
export type FinanceScope = 'business' | 'personal'
export type PlanType = 'entrenamiento' | 'nutricion' | 'combo'
export type NutritionAttendanceStatus = 'P' | 'A' | 'ST'
export type NutritionDocumentCategory = 'antropometria' | 'anamnesis' | 'laboratorio'
export type NutritionFoodPortionBasis = 'crudo' | 'cocido' | 'no_especificado'

/** Referencia al guardar en Guía: cómo se usa al armar el plan (cantidad en g, uds. o ml para el alumno). */
export type NutritionFoodMacroQtyPresentation = 'grams' | 'units' | 'volume'
export type NutritionFoodExternalSource = 'manual' | 'usda_fdc'
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
export type ReminderChannel = 'app' | 'email' | 'whatsapp'
export type FormStatus = 'recibido' | 'revisado' | 'en_proceso'
export type NotificationType =
  | 'rutina_por_vencer'
  | 'form_recibido'
  | 'pdf_generado'
  | 'consulta_recibida'
  | 'feedback_enviado'
  | 'pago_pendiente'
  | 'pago_registrado'
  | 'sistema'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id'>>
        Relationships: []
      }
      students: {
        Row: Student
        Insert: Omit<Student, 'id' | 'created_at' | 'updated_at'> &
          Partial<
            Pick<
              Student,
              | 'document_id'
              | 'address'
              | 'weight_kg'
              | 'height_cm'
              | 'intake_ferster'
              | 'selected_web_plan_slug'
              | 'avatar_path'
            >
          >
        Update: Partial<Omit<Student, 'id' | 'created_at'>>
        Relationships: []
      }
      plans: {
        Row: Plan
        Insert: Omit<Plan, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Plan, 'id' | 'created_at'>>
        Relationships: []
      }
      routines: {
        Row: Routine
        Insert: Omit<Routine, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Routine, 'id' | 'created_at'>>
        Relationships: []
      }
      routine_blocks: {
        Row: RoutineBlock
        Insert: Omit<RoutineBlock, 'id'>
        Update: Partial<Omit<RoutineBlock, 'id'>>
        Relationships: []
      }
      routine_days: {
        Row: RoutineDay
        Insert: Omit<RoutineDay, 'id'>
        Update: Partial<Omit<RoutineDay, 'id'>>
        Relationships: []
      }
      routine_exercises: {
        Row: RoutineExercise
        Insert: Omit<RoutineExercise, 'id'>
        Update: Partial<Omit<RoutineExercise, 'id'>>
        Relationships: []
      }
      routine_blueprints: {
        Row: RoutineBlueprint
        Insert: Omit<RoutineBlueprint, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<RoutineBlueprint, 'id' | 'created_at'>>
        Relationships: []
      }
      web_plans: {
        Row: WebPlan
        Insert: Omit<WebPlan, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<WebPlan, 'id' | 'created_at'>>
        Relationships: []
      }
      web_intake_catalog_settings: {
        Row: WebIntakeCatalogSettings
        Insert: Omit<WebIntakeCatalogSettings, 'updated_at'>
        Update: Partial<Omit<WebIntakeCatalogSettings, 'id'>>
        Relationships: []
      }
      exercise_library: {
        Row: Exercise
        Insert: Omit<Exercise, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Exercise, 'id' | 'created_at'>>
        Relationships: []
      }
      muscle_groups: {
        Row: MuscleGroup
        Insert: Omit<MuscleGroup, 'id'>
        Update: Partial<Omit<MuscleGroup, 'id'>>
        Relationships: []
      }
      routine_pdfs: {
        Row: RoutinePdf
        Insert: Omit<RoutinePdf, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<RoutinePdf, 'id' | 'created_at'>>
        Relationships: []
      }
      routine_questions: {
        Row: RoutineQuestion
        Insert: Omit<RoutineQuestion, 'id' | 'received_at'>
        Update: Partial<Omit<RoutineQuestion, 'id'>>
        Relationships: []
      }
      routine_feedback: {
        Row: RoutineFeedback
        Insert: Omit<RoutineFeedback, 'id' | 'responded_at'>
        Update: Partial<Omit<RoutineFeedback, 'id'>>
        Relationships: []
      }
      nutrition_patient_followups: {
        Row: NutritionPatientFollowup
        Insert: Omit<NutritionPatientFollowup, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<NutritionPatientFollowup, 'id' | 'created_at'>>
        Relationships: []
      }
      nutrition_patient_documents: {
        Row: NutritionPatientDocument
        Insert: Omit<NutritionPatientDocument, 'id' | 'uploaded_at'>
        Update: Partial<Omit<NutritionPatientDocument, 'id' | 'uploaded_at'>>
        Relationships: []
      }
      nutrition_plan_notes: {
        Row: NutritionPlanNote
        Insert: Omit<NutritionPlanNote, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<NutritionPlanNote, 'id' | 'created_at'>>
        Relationships: []
      }
      nutrition_measurements: {
        Row: NutritionMeasurement
        Insert: Omit<NutritionMeasurement, 'id' | 'created_at'>
        Update: Partial<Omit<NutritionMeasurement, 'id' | 'created_at'>>
        Relationships: []
      }
      nutrition_clinical_notes: {
        Row: NutritionClinicalNote
        Insert: Omit<NutritionClinicalNote, 'id' | 'created_at'>
        Update: Partial<Omit<NutritionClinicalNote, 'id' | 'created_at'>>
        Relationships: []
      }
      nutrition_symptom_checkins: {
        Row: NutritionSymptomCheckin
        Insert: Omit<NutritionSymptomCheckin, 'id' | 'created_at'>
        Update: Partial<Omit<NutritionSymptomCheckin, 'id' | 'created_at'>>
        Relationships: []
      }
      nutrition_anamnesis: {
        Row: NutritionAnamnesis
        Insert: Omit<NutritionAnamnesis, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<NutritionAnamnesis, 'id' | 'created_at'>>
        Relationships: []
      }
      nutrition_week_schedules: {
        Row: NutritionWeekSchedule
        Insert: Omit<NutritionWeekSchedule, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<NutritionWeekSchedule, 'id' | 'created_at'>>
        Relationships: []
      }
      nutrition_week_plan_templates: {
        Row: NutritionWeekPlanTemplate
        Insert: Omit<NutritionWeekPlanTemplate, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<NutritionWeekPlanTemplate, 'id' | 'created_at'>>
        Relationships: []
      }
      nutrition_plan_library: {
        Row: NutritionPlanLibrary
        Insert: Omit<NutritionPlanLibrary, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<NutritionPlanLibrary, 'id' | 'created_at'>>
        Relationships: []
      }
      nutrition_food_library: {
        Row: NutritionFoodLibrary
        Insert: Omit<NutritionFoodLibrary, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<NutritionFoodLibrary, 'id' | 'created_at'>>
        Relationships: []
      }
      nutrition_planning_workbooks: {
        Row: NutritionPlanningWorkbook
        Insert: Omit<NutritionPlanningWorkbook, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<NutritionPlanningWorkbook, 'id' | 'created_at'>>
        Relationships: []
      }
      nutrition_planning_workbook_templates: {
        Row: NutritionPlanningWorkbookTemplate
        Insert: Omit<NutritionPlanningWorkbookTemplate, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<NutritionPlanningWorkbookTemplate, 'id' | 'created_at'>>
        Relationships: []
      }
      student_progress_photos: {
        Row: StudentProgressPhoto
        Insert: Omit<StudentProgressPhoto, 'id' | 'created_at'>
        Update: Partial<Omit<StudentProgressPhoto, 'id' | 'created_at'>>
        Relationships: []
      }
      trainer_student_meal_plans: {
        Row: TrainerStudentMealPlan
        Insert: Omit<TrainerStudentMealPlan, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TrainerStudentMealPlan, 'id' | 'created_at'>>
        Relationships: []
      }
      nutrition_patient_plan_versions: {
        Row: NutritionPatientPlanVersion
        Insert: Omit<NutritionPatientPlanVersion, 'id' | 'created_at' | 'updated_at' | 'imported_at'>
        Update: Partial<Omit<NutritionPatientPlanVersion, 'id' | 'created_at' | 'imported_at'>>
        Relationships: []
      }
      appointments: {
        Row: Appointment
        Insert: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Appointment, 'id' | 'created_at'>>
        Relationships: []
      }
      appointment_reminders: {
        Row: AppointmentReminder
        Insert: Omit<AppointmentReminder, 'id' | 'created_at'>
        Update: Partial<Omit<AppointmentReminder, 'id' | 'created_at'>>
        Relationships: []
      }
      personal_calendar_items: {
        Row: PersonalCalendarItem
        Insert: Omit<PersonalCalendarItem, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<PersonalCalendarItem, 'id' | 'created_at'>>
        Relationships: []
      }
      income: {
        Row: Income
        Insert: Omit<Income, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Income, 'id' | 'created_at'>>
        Relationships: []
      }
      expenses: {
        Row: Expense
        Insert: Omit<Expense, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Expense, 'id' | 'created_at'>>
        Relationships: []
      }
      check_in_forms: {
        Row: CheckInForm
        Insert: Omit<CheckInForm, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CheckInForm, 'id' | 'created_at'>>
        Relationships: []
      }
      check_in_invites: {
        Row: CheckInInvite
        Insert: Omit<CheckInInvite, 'id' | 'created_at'>
        Update: Partial<Omit<CheckInInvite, 'id' | 'created_at'>>
        Relationships: []
      }
      check_in_responses: {
        Row: CheckInResponse
        Insert: Omit<CheckInResponse, 'id' | 'submitted_at' | 'responder_email' | 'email_verified'> & {
          responder_email?: string | null
          email_verified?: boolean
        }
        Update: Partial<Omit<CheckInResponse, 'id' | 'submitted_at'>>
        Relationships: []
      }
      check_in_send_schedules: {
        Row: CheckInSendSchedule
        Insert: Omit<CheckInSendSchedule, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CheckInSendSchedule, 'id' | 'created_at'>>
        Relationships: []
      }
      trainer_message_templates: {
        Row: TrainerMessageTemplate
        Insert: Omit<TrainerMessageTemplate, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TrainerMessageTemplate, 'id' | 'created_at'>>
        Relationships: []
      }
      trainer_resources: {
        Row: TrainerResource
        Insert: Omit<TrainerResource, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TrainerResource, 'id' | 'created_at'>>
        Relationships: []
      }
      trainer_resource_sends: {
        Row: TrainerResourceSend
        Insert: Omit<TrainerResourceSend, 'id' | 'sent_at'>
        Update: Partial<Omit<TrainerResourceSend, 'id'>>
        Relationships: []
      }
      trainer_resource_send_schedules: {
        Row: TrainerResourceSendSchedule
        Insert: Omit<TrainerResourceSendSchedule, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TrainerResourceSendSchedule, 'id' | 'created_at'>>
        Relationships: []
      }
      notifications: {
        Row: Notification
        Insert: Omit<Notification, 'id' | 'created_at'>
        Update: Partial<Omit<Notification, 'id' | 'created_at'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_check_in_form_by_token: {
        Args: { p_token: string }
        Returns: Json
      }
      get_check_in_form_by_public_token: {
        Args: { p_public_token: string }
        Returns: Json
      }
      submit_check_in_response: {
        Args: { p_token: string; p_answers: Json; p_testimonial_consent: boolean; p_responder_email: string }
        Returns: Json
      }
      submit_check_in_shared_response: {
        Args: {
          p_public_token: string
          p_answers: Json
          p_testimonial_consent: boolean
          p_responder_email: string
        }
        Returns: Json
      }
      register_trainer_resource_sends: {
        Args: { p_resource_id: string; p_student_ids: string[] }
        Returns: Json
      }
      notify_user: {
        Args: {
          p_user_id: string
          p_type: NotificationType
          p_title: string
          p_body: string
          p_linked_table?: string | null
          p_linked_id?: string | null
        }
        Returns: string
      }
    }
  }
}

export interface Profile {
  id: string
  full_name: string
  avatar_url: string | null
  role: AppRole
  google_calendar_id: string | null
  phone: string | null
  bio: string | null
  created_at: string
  updated_at: string
}

/** Cuestionario nutricional (/form → nutrición); `uploads` mapea clave → ruta en bucket `student-intake`. */
export type NutritionIntakeStored = {
  version: number
  form_type: 'nutrition' | 'full'
  motivo_consulta: string
  profession: string
  work_hours: string
  marital_status: string
  family_composition: string
  hobbies: string
  pathologies: string
  medications: string
  supplementation: string
  symptoms: string
  family_history: string
  smoking: string
  has_physical_activity: string
  activity_type: string
  activity_since: string
  activity_frequency: string
  activity_duration: string
  activity_intensity: string
  first_meal_time: string
  meals_per_day: string
  skipped_meal: string
  last_meal_time: string
  digestive_intolerances: string
  common_preparations: string
  record_breakfast: string
  record_lunch: string
  record_snack: string
  record_dinner: string
  record_collations: string
  food_freq: Record<string, { tipo: string; frecuencia: string; cantidad: string }>
  frequent_vegetables: string
  frequent_fruits: string
  good_habit_1: string
  good_habit_2: string
  good_habit_3: string
  bad_habit_1: string
  bad_habit_2: string
  bad_habit_3: string
  other_notes: string
  submitted_at: string
  uploads: Record<string, string>
  /** Preferencia declarada en /form (efectivo vs Mercado Pago). */
  payment_preference?: 'cash' | 'mercadopago'
  /** Alias, comprobante u observación de pago (opcional). */
  payment_notes?: string | null
}

/** Cuestionario web Ferster (/form); `uploads` mapea clave → ruta en bucket `student-intake`. */
export type FersterIntakeStored = {
  version: number
  training_since: string
  days_per_week: number
  lifestyle: string
  training_intensity: string
  session_duration: string
  equipment: string
  main_goal: string
  pathology: string
  pathology_detail?: string | null
  discomfort_exercises: string
  four_meals: string
  sleep_hours: string
  supplements: string
  gender_other?: string | null
  submitted_at?: string
  uploads?: Record<string, string>
  /** Preferencia declarada en /form (efectivo vs Mercado Pago). */
  payment_preference?: 'cash' | 'mercadopago'
  /** Alias, comprobante u observación de pago (opcional). */
  payment_notes?: string | null
}

/** Cuestionario web psicología deportiva (/form). */
export type PsychologistIntakeStored = {
  version?: number
  form_type?: 'psychologist'
  residence?: string
  sport_practiced?: string
  emergency_contact?: string
  selected_plan_slug?: string | null
  submitted_at?: string
  payment_preference?: 'cash' | 'mercadopago'
  payment_notes?: string | null
}

export interface Student {
  id: string
  owner_id: string
  profile_id: string | null
  full_name: string
  email: string | null
  phone: string | null
  birth_date: string | null
  level: StudentLevel
  gender: 'M' | 'F' | 'otro' | null
  status: StudentStatus
  notes: string | null
  document_id: string | null
  address: string | null
  weight_kg: number | null
  height_cm: number | null
  selected_web_plan_slug: string | null
  intake_ferster: FersterIntakeStored | null
  /** Cuestionario nutricional web. */
  intake_nutrition: NutritionIntakeStored | null
  /** Cuestionario psicología deportiva web. */
  intake_psychologist: PsychologistIntakeStored | null
  /** Ruta dentro del bucket `student-avatars` (p. ej. `{uuid}/avatar.jpg`). */
  avatar_path: string | null
  /** Fecha de vencimiento del plan activo (ISO date YYYY-MM-DD). */
  plan_end_date: string | null
  /** Etiquetas libres del entrenador (sync entre dispositivos). */
  trainer_tags: string[]
  /** Cuota mensual de referencia (ARS). */
  monthly_fee_amount: number | null
  /** Peso objetivo en kg (seguimiento). */
  target_weight_kg: number | null
  created_at: string
  updated_at: string
}

/** Fila del historial de alumnos/pacientes eliminados (RPC list_my_student_deletions). */
export interface StudentDeletionLogEntry {
  id: string
  student_id: string
  full_name: string
  email: string | null
  phone: string | null
  status: string | null
  deleted_at: string
  deleted_by: string | null
  deleted_by_name: string | null
  primary_owner_id: string | null
  primary_owner_name: string | null
  can_restore?: boolean
  avatar_path?: string | null
  birth_date?: string | null
  level?: string | null
  plan_end_date?: string | null
}

export interface Plan {
  id: string
  owner_id: string
  name: string
  description: string | null
  type: PlanType
  duration_days: number
  price: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Routine {
  id: string
  owner_id: string
  student_id: string
  student_plan_id: string | null
  name: string
  objective: string
  level: StudentLevel
  start_date: string
  end_date: string
  duration_days: number
  price: number | null
  status: RoutineStatus
  notes: string | null
  last_status_change: string | null
  created_at: string
  updated_at: string
  student?: Student
}

export interface RoutineBlock {
  id: string
  routine_id: string
  name: string
  sort_order: number
  notes: string | null
  start_date: string | null
  end_date: string | null
}

export interface RoutineDay {
  id: string
  block_id: string
  day_name: string
  day_of_week: number | null
  muscle_focus: string | null
  warmup_notes: string | null
  sort_order: number
}

export interface TrainingMethodCategory {
  id: string
  owner_id: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface TrainingMethod {
  id: string
  owner_id: string
  category_id: string | null
  name: string
  default_reps_scheme: string | null
  default_sets: number | null
  /** Guía privada del entrenador; no se muestra en PDF ni al alumno. */
  coach_guide: string | null
  sort_order: number
  created_at: string
  updated_at: string
  category?: TrainingMethodCategory | null
}

export interface RoutineExercise {
  id: string
  day_id: string
  exercise_id: string
  sort_order: number
  sets: number | null
  reps_min: number | null
  reps_max: number | null
  reps_scheme: string | null   // e.g. "8 / 6 / 5" — free-text reps per set
  weight_kg: number | null
  rir: number | null
  rpe: number | null
  rest_seconds: number | null
  tempo: string | null
  video_url: string | null
  technical_notes: string | null
  is_superset: boolean
  superset_group: number | null
  training_method_id: string | null
  /** Notas privadas al aplicar un método en esta rutina (no PDF). */
  method_coach_notes: string | null
  exercise?: Exercise
  training_method?: TrainingMethod | null
}

export interface Exercise {
  id: string
  owner_id: string | null
  muscle_group_id: string
  name: string
  slug: string
  description: string | null
  common_errors: string | null
  equipment: string[] | null
  difficulty: 'basico' | 'intermedio' | 'avanzado'
  video_url: string | null
  image_url: string | null
  is_system: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  muscle_group?: MuscleGroup
}

export interface MuscleGroup {
  id: string
  name: string
  slug: string
  sort_order: number
}

export interface RoutineBlueprint {
  id: string
  owner_id: string
  name: string
  description: string | null
  payload: Json
  created_at: string
  updated_at: string
}

export type WebPlanCatalogSegment =
  | 'solo'
  | 'with_nutritionist'
  | 'full'
  | 'full_trio'
  | 'psychologist'

/** Profesional asociado a una sección de «Incluye» en `web_plans`. */
export type WebPlanIncludeProfessional = 'trainer' | 'psychologist' | 'nutritionist'

export interface WebPlanIncludeSection {
  professional: WebPlanIncludeProfessional
  items: string[]
}

export interface WebPlan {
  id: string
  slug: string
  title: string
  price_label: string
  /** Precio modalidad anual en /form; opcional. */
  price_yearly_label?: string | null
  /** Opcional: etiqueta para x3 en /form; vacío → se calcula desde `price_label`. */
  price_3m_label?: string | null
  /** Opcional: etiqueta para x6 en /form; vacío → se calcula desde `price_label`. */
  price_6m_label?: string | null
  short_description: string
  intro_text: string
  includes_items: string[]
  /** Secciones de «Incluye» por profesional; vacío = derivar de `includes_items` en la app. */
  includes_sections?: WebPlanIncludeSection[] | null
  gifts_items: string[]
  /** Formulario público: solo nutrición vs full vs solo entrenador. */
  catalog_segment: WebPlanCatalogSegment
  /** Texto libre tipo credencial en la card de detalle del plan; vacío = usar la del segmento. */
  credential_line_override?: string | null
  /** Etiqueta corta tipo chip (ej. Entrenamiento); null = usar heurística por slug */
  display_badge: string | null
  sort_order: number
  is_active: boolean
  /** Si false, la oferta no se lista como card en /form. El toggle Mensual/x3/x6/Anual sólo cambia precios; el contenido lo define cada fila. */
  show_in_public_intake: boolean
  created_at: string
  updated_at: string
}

/** Fila única típica id=1: assets y cupos del formulario público /form. */
export interface WebIntakeCatalogSettings {
  id: number
  solo_segment_image_url: string | null
  with_nutritionist_segment_image_url: string | null
  full_segment_image_url: string | null
  /** Tras migración 20260516120000. */
  cris_solo_segment_image_url?: string | null
  /** Foto del psicólogo en bloques «Incluye» del /form. */
  psychologist_segment_image_url?: string | null
  testimonial_videos: string[] | null
  intake_slots_open?: boolean
  intake_slots_remaining?: number | null
  intake_slots_public_message?: string | null
  /** Etiquetas del selector «Modalidad» en /form (opcional; vacío = default en cliente). */
  modality_label_solo?: string | null
  modality_label_with_nutritionist?: string | null
  modality_label_full?: string | null
  modality_label_psychologist?: string | null
  modality_label_full_trio?: string | null
  updated_at: string
}

export interface RoutinePdf {
  id: string
  owner_id: string
  routine_id: string
  student_id: string
  form_id: string | null
  status: PdfStatus
  file_path: string | null
  file_size_kb: number | null
  generated_at: string | null
  sent_at: string | null
  sent_via: string | null
  error_message: string | null
  created_at: string
  updated_at: string
  routine?: Routine
  student?: Student
}

export interface RoutineQuestion {
  id: string
  owner_id: string
  student_id: string
  routine_id: string | null
  exercise_id: string | null
  title: string
  description: string
  media_url: string | null
  status: QuestionStatus
  received_at: string
  closed_at: string | null
  student?: Student
  routine?: Routine
}

export interface RoutineFeedback {
  id: string
  owner_id: string
  question_id: string
  text_response: string | null
  video_path: string | null
  video_url_external: string | null
  pdf_path: string | null
  responded_at: string
}

export interface NutritionPatientFollowup {
  id: string
  owner_id: string
  student_id: string
  last_consultation_date: string | null
  next_consultation_date: string | null
  attendance_status: NutritionAttendanceStatus
  created_at: string
  updated_at: string
}

export interface NutritionPatientDocument {
  id: string
  owner_id: string
  student_id: string
  category: NutritionDocumentCategory
  title: string
  file_path: string
  document_date: string
  uploaded_at: string
}

export interface NutritionPlanNote {
  id: string
  owner_id: string
  student_id: string
  content: string
  created_at: string
  updated_at: string
}

export interface NutritionMeasurement {
  id: string
  owner_id: string
  student_id: string
  measured_at: string
  weight_kg: number | null
  bmi: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  perimeters_notes: string | null
  skinfolds_notes: string | null
  notes: string | null
  /** N° de medición (programa de antropometría). */
  measurement_number: number | null
  height_cm: number | null
  sitting_height_cm: number | null
  /** Series, medianas y metadatos del programa (JSON). */
  detail: Json
  created_at: string
}

export interface NutritionClinicalNote {
  id: string
  owner_id: string
  student_id: string
  occurred_at: string
  title: string
  body: string
  created_at: string
}

export interface NutritionSymptomCheckin {
  id: string
  owner_id: string
  student_id: string
  logged_at: string
  digestive_discomfort_0_10: number | null
  adherence_1_5: number | null
  notes: string | null
  created_at: string
}

export interface NutritionAnamnesis {
  id: string
  owner_id: string
  student_id: string
  payload: Json
  schema_version: number
  created_at: string
  updated_at: string
}

export interface NutritionWeekSchedule {
  id: string
  owner_id: string
  student_id: string
  total_kcal: number | null
  next_consultation_date: string | null
  merge_weekends: boolean
  grid: Json
  created_at: string
  updated_at: string
}

export interface NutritionWeekPlanTemplate {
  id: string
  owner_id: string
  name: string
  merge_weekends: boolean
  grid: Json
  created_at: string
  updated_at: string
}

export interface NutritionPlanLibrary {
  id: string
  owner_id: string
  name: string
  objective: string | null
  notes: string | null
  tags: string[]
  merge_weekends: boolean
  grid: Json
  created_at: string
  updated_at: string
}

/** Alimentos propios del nutricionista con macros típicamente por 100 g. */
/** Planificación tipo Excel (macros + grillas); una fila por usuario. */
export interface NutritionPlanningWorkbook {
  id: string
  owner_id: string
  title: string
  data: Json
  created_at: string
  updated_at: string
}

/** Plantilla reutilizable del workbook de planificación (JSON completo). */
export interface NutritionPlanningWorkbookTemplate {
  id: string
  owner_id: string
  name: string
  description: string | null
  data: Json
  created_at: string
  updated_at: string
}

/** Foto de evolución corporal asociada a un mes (YYYY-MM). */
export interface StudentProgressPhoto {
  id: string
  owner_id: string
  student_id: string
  year_month: string
  storage_path: string
  note: string | null
  created_at: string
}

/** Plan Excel HH asignado por entrenador a un alumno (varios por alumno). */
export interface TrainerStudentMealPlan {
  id: string
  owner_id: string
  student_id: string
  title: string
  data: Json
  cloned_from_id: string | null
  created_at: string
  updated_at: string
}

export interface NutritionFoodLibrary {
  id: string
  owner_id: string
  display_name: string
  /** Agrupa ítems en «Mi lista» (nombre libre, ej. Lácteos). */
  category: string
  external_source: NutritionFoodExternalSource
  external_fdc_id: number | null
  protein_g_per_100g: number | null
  fat_g_per_100g: number | null
  carbs_g_per_100g: number | null
  fiber_g_per_100g: number | null
  energy_kcal_per_100g: number | null
  /** Gramos de referencia para P/G/HC/kcal (ej. 25 pan, 50 dulce de leche). Por defecto 100. */
  macro_ref_basis_g: number
  portion_basis: NutritionFoodPortionBasis
  macro_qty_presentation: NutritionFoodMacroQtyPresentation
  source_label: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface NutritionPatientPlanVersion {
  id: string
  owner_id: string
  student_id: string
  source_library_id: string | null
  version_number: number
  is_active: boolean
  imported_at: string
  replaced_version_id: string | null
  title: string
  total_kcal: number | null
  next_consultation_date: string | null
  merge_weekends: boolean
  grid: Json
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  owner_id: string
  student_id: string
  profile_type: 'trainer' | 'nutritionist'
  starts_at: string
  ends_at: string | null
  status: AppointmentStatus
  title: string
  notes: string | null
  location: string | null
  google_event_id: string | null
  created_at: string
  updated_at: string
}

export interface AppointmentReminder {
  id: string
  owner_id: string
  appointment_id: string
  channel: ReminderChannel
  scheduled_for: string
  sent_at: string | null
  status: 'pending' | 'sent' | 'failed'
  error_message: string | null
  created_at: string
}

/** Eventos de agenda solo del profesional (no asociados a `students`). */
export interface PersonalCalendarItem {
  id: string
  owner_id: string
  title: string
  starts_at: string
  ends_at: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Income {
  id: string
  owner_id: string
  income_date: string
  student_id: string | null
  student_plan_id: string | null
  income_type: string
  category: string
  description: string
  amount: number
  payment_method: PaymentMethod
  scope: FinanceScope
  status: IncomeStatus
  receipt_path: string | null
  notes: string | null
  created_at: string
  updated_at: string
  student?: Student
}

export interface Expense {
  id: string
  owner_id: string
  expense_date: string
  category: string
  subcategory: string | null
  description: string
  amount: number
  expense_type: ExpenseType
  payment_method: PaymentMethod
  scope: FinanceScope
  receipt_path: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MenstrualCycle {
  id: string
  owner_id: string
  student_id: string
  cycle_start_date: string
  cycle_length: number
  notes: string | null
  created_at: string
}

export interface Habit {
  id: string
  owner_id: string
  name: string
  emoji: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface StudentHabitSelection {
  student_id: string
  habit_id: string
  owner_id: string
  created_at: string
}

export interface HabitLog {
  id: string
  owner_id: string
  student_id: string
  habit_id: string
  log_date: string
  created_at: string
}

/** Cuándo se asignó o quitó un hábito al alumno (auditoría / evolución). */
export interface StudentHabitSelectionEvent {
  id: string
  owner_id: string
  student_id: string
  habit_id: string
  action: 'assigned' | 'removed'
  created_at: string
}

export interface StudentRmRecord {
  id: string
  owner_id: string
  student_id: string
  exercise_id: string
  rm_kg: number
  tested_at: string
  source: 'test' | 'epley'
  notes: string | null
  created_at: string
  exercise?: Pick<Exercise, 'id' | 'name'>
}

export interface StudentWeightLog {
  id: string
  owner_id: string
  student_id: string
  logged_at: string      // ISO date YYYY-MM-DD
  weight_kg: number
  body_fat_pct: number | null
  notes: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  linked_table: string | null
  linked_id: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface TrainerMessageTemplate {
  id: string
  owner_id: string
  title: string
  body: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface TrainerResource {
  id: string
  owner_id: string
  title: string
  url: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface TrainerResourceSend {
  id: string
  owner_id: string
  resource_id: string
  student_id: string
  sent_at: string
}

export interface TrainerResourceSendSchedule {
  id: string
  owner_id: string
  /** Recurso con URL; mutuamente excluyente con `template_id`. */
  resource_id: string | null
  /** Plantilla de texto; mutuamente excluyente con `resource_id`. */
  template_id?: string | null
  is_enabled: boolean
  day_of_week: number
  timezone: string
  prefer_group_whatsapp: boolean
  created_at: string
  updated_at: string
}

/** Fila del historial de rutinas eliminadas (RPC list_my_routine_deletions). */
export interface RoutineDeletionLogEntry {
  id: string
  routine_id: string
  routine_name: string
  student_id: string
  student_name: string | null
  objective: string | null
  level: string | null
  status: string | null
  start_date: string | null
  end_date: string | null
  deleted_at: string
  deleted_by: string | null
  deleted_by_name: string | null
  can_restore?: boolean
}

/** Fila del historial de antropometrías eliminadas (RPC list_my_nutrition_measurement_deletions). */
export interface NutritionMeasurementDeletionLogEntry {
  id: string
  measurement_id: string
  student_id: string
  student_name: string | null
  measured_at: string | null
  measurement_number: number | null
  weight_kg: number | null
  bmi: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  deleted_at: string
  deleted_by: string | null
  deleted_by_name: string | null
  can_restore?: boolean
}

export interface CheckInForm {
  id: string
  owner_id: string
  title: string
  intro: string | null
  questions: Json
  is_active: boolean
  /** Link único para todo el grupo (/form/check-in/compartido/…). */
  public_token?: string
  created_at: string
  updated_at: string
}

export interface CheckInInvite {
  id: string
  form_id: string
  student_id: string
  token: string
  created_at: string
}

export interface CheckInResponse {
  id: string
  invite_id: string
  responses: Json
  testimonial_consent: boolean
  submitted_at: string
  responder_email: string | null
  email_verified: boolean
  /**
   * Timestamp en que el trainer marcó la respuesta como respondida (después
   * de contestarle al alumno por WhatsApp/manualmente).
   * - `null` → todavía pendiente de respuesta por parte del trainer.
   * - timestamp → respondido en esa fecha.
   *
   * Se setea/desetea vía RPC `set_check_in_response_trainer_status`.
   */
  trainer_replied_at: string | null
  /** Nota privada del trainer asociada a esta respuesta. No visible para el alumno. */
  trainer_note: string | null
}

export interface CheckInSendSchedule {
  id: string
  owner_id: string
  form_id: string
  is_enabled: boolean
  /** 0 domingo … 6 sábado (como Date.getDay() en la fecha local de `timezone`). */
  day_of_week: number
  timezone: string
  prefer_group_whatsapp: boolean
  created_at: string
  updated_at: string
}
