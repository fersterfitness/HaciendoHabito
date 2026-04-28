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
      }
      students: {
        Row: Student
        Insert: Omit<Student, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Student, 'id' | 'created_at'>>
      }
      plans: {
        Row: Plan
        Insert: Omit<Plan, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Plan, 'id' | 'created_at'>>
      }
      routines: {
        Row: Routine
        Insert: Omit<Routine, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Routine, 'id' | 'created_at'>>
      }
      routine_blocks: {
        Row: RoutineBlock
        Insert: Omit<RoutineBlock, 'id'>
        Update: Partial<Omit<RoutineBlock, 'id'>>
      }
      routine_days: {
        Row: RoutineDay
        Insert: Omit<RoutineDay, 'id'>
        Update: Partial<Omit<RoutineDay, 'id'>>
      }
      routine_exercises: {
        Row: RoutineExercise
        Insert: Omit<RoutineExercise, 'id'>
        Update: Partial<Omit<RoutineExercise, 'id'>>
      }
      exercise_library: {
        Row: Exercise
        Insert: Omit<Exercise, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Exercise, 'id' | 'created_at'>>
      }
      muscle_groups: {
        Row: MuscleGroup
        Insert: Omit<MuscleGroup, 'id'>
        Update: Partial<Omit<MuscleGroup, 'id'>>
      }
      routine_pdfs: {
        Row: RoutinePdf
        Insert: Omit<RoutinePdf, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<RoutinePdf, 'id' | 'created_at'>>
      }
      routine_questions: {
        Row: RoutineQuestion
        Insert: Omit<RoutineQuestion, 'id' | 'received_at'>
        Update: Partial<Omit<RoutineQuestion, 'id'>>
      }
      routine_feedback: {
        Row: RoutineFeedback
        Insert: Omit<RoutineFeedback, 'id' | 'responded_at'>
        Update: Partial<Omit<RoutineFeedback, 'id'>>
      }
      nutrition_patient_followups: {
        Row: NutritionPatientFollowup
        Insert: Omit<NutritionPatientFollowup, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<NutritionPatientFollowup, 'id' | 'created_at'>>
      }
      nutrition_patient_documents: {
        Row: NutritionPatientDocument
        Insert: Omit<NutritionPatientDocument, 'id' | 'uploaded_at'>
        Update: Partial<Omit<NutritionPatientDocument, 'id' | 'uploaded_at'>>
      }
      nutrition_plan_notes: {
        Row: NutritionPlanNote
        Insert: Omit<NutritionPlanNote, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<NutritionPlanNote, 'id' | 'created_at'>>
      }
      nutrition_measurements: {
        Row: NutritionMeasurement
        Insert: Omit<NutritionMeasurement, 'id' | 'created_at'>
        Update: Partial<Omit<NutritionMeasurement, 'id' | 'created_at'>>
      }
      appointments: {
        Row: Appointment
        Insert: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Appointment, 'id' | 'created_at'>>
      }
      appointment_reminders: {
        Row: AppointmentReminder
        Insert: Omit<AppointmentReminder, 'id' | 'created_at'>
        Update: Partial<Omit<AppointmentReminder, 'id' | 'created_at'>>
      }
      income: {
        Row: Income
        Insert: Omit<Income, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Income, 'id' | 'created_at'>>
      }
      expenses: {
        Row: Expense
        Insert: Omit<Expense, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Expense, 'id' | 'created_at'>>
      }
      notifications: {
        Row: Notification
        Insert: Omit<Notification, 'id' | 'created_at'>
        Update: Partial<Omit<Notification, 'id' | 'created_at'>>
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
