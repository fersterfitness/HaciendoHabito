export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type AppRole = 'admin' | 'trainer' | 'nutritionist' | 'student'
export type StudentLevel = 'inicial' | 'intermedio' | 'avanzado'
export type StudentStatus = 'activo' | 'inactivo' | 'pausado' | 'baja'
export type RoutineStatus = 'activa' | 'por_vencer' | 'vencida' | 'pausada' | 'cancelada'
export type PdfStatus = 'pendiente' | 'en_proceso' | 'generado' | 'enviado' | 'error'
export type QuestionStatus = 'recibida' | 'en_revision' | 'devuelta' | 'cerrada'
export type PaymentStatus = 'pendiente' | 'cobrado' | 'cancelado' | 'reembolsado'
export type IncomeStatus = 'pendiente' | 'cobrado' | 'cancelado'
export type ExpenseType = 'fijo' | 'variable'
export type PaymentMethod = 'efectivo_debito' | 'tarjeta_credito' | 'transferencia' | 'otro'
export type PlanType = 'entrenamiento' | 'nutricion' | 'combo'
export type NutritionAttendanceStatus = 'P' | 'A' | 'ST'
export type NutritionDocumentCategory = 'antropometria' | 'anamnesis'
export type NutritionFoodPortionBasis = 'crudo' | 'cocido' | 'no_especificado'
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
      notifications: {
        Row: Notification
        Insert: Omit<Notification, 'id' | 'created_at'>
        Update: Partial<Omit<Notification, 'id' | 'created_at'>>
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
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
  form_type: 'nutrition'
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
  intake_ferster: FersterIntakeStored | null
  /** Cuestionario nutricional web. */
  intake_nutrition: NutritionIntakeStored | null
  /** Ruta dentro del bucket `student-avatars` (p. ej. `{uuid}/avatar.jpg`). */
  avatar_path: string | null
  /** Fecha de vencimiento del plan activo (ISO date YYYY-MM-DD). */
  plan_end_date: string | null
  created_at: string
  updated_at: string
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
  exercise?: Exercise
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
  external_source: NutritionFoodExternalSource
  external_fdc_id: number | null
  protein_g_per_100g: number | null
  fat_g_per_100g: number | null
  carbs_g_per_100g: number | null
  fiber_g_per_100g: number | null
  energy_kcal_per_100g: number | null
  portion_basis: NutritionFoodPortionBasis
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
