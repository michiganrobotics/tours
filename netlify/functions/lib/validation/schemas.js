/**
 * Validation schemas using Zod
 * Defines input validation for all API endpoints
 */

const { z } = require('zod');

// Tour Request validation schema
const TourRequestSchema = z.object({
  visitor_name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  
  visitor_email: z.string()
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters')
    .trim()
    .toLowerCase(),
  
  visitor_phone: z.string()
    .max(20, 'Phone number must be less than 20 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  
  group_size: z.union([
    z.string().transform(val => parseInt(val, 10)),
    z.number()
  ]).pipe(
    z.number()
      .int('Group size must be a whole number')
      .min(1, 'Group size must be at least 1')
      .max(50, 'Group size cannot exceed 50 people')
  ),
  
  preferred_date: z.string()
    .min(1, 'Please select your preferred date')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine(date => {
      const tourDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return tourDate >= today;
    }, 'Tour date must be today or in the future'),
  
  preferred_time: z.string()
    .min(1, 'Please select your preferred time')
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format'),
  
  additional_info: z.string()
    .max(1000, 'Additional information must be less than 1000 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  
  tshirt_request: z.union([
    z.string(),
    z.boolean()
  ]).optional(),
  
  tshirt_sizes: z.record(z.string(), z.union([
    z.string().transform(val => parseInt(val, 10)),
    z.number()
  ]).pipe(z.number().int().min(0).max(20)))
    .optional()
    .default({})
    .refine((sizes) => {
      const total = Object.values(sizes).reduce((sum, qty) => sum + qty, 0);
      return total <= 20;
    }, {
      message: 'Total t-shirt quantity cannot exceed 20. For larger orders, please visit our online store at https://www.aatwebstore.com/UMBOT/shop/home'
    }),
  
  newsletter_signup: z.union([
    z.string(),
    z.boolean()
  ]).optional()
});

// Tour Request update schema (admin edit form / API updates).
// Same field rules as TourRequestSchema, but every field is optional, empty
// strings are allowed, and there is no future-date requirement so existing
// requests with past or flexible dates remain editable.
const TourRequestUpdateSchema = z.object({
  id: z.string().min(1, 'Request ID is required'),

  visitor_name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim()
    .optional(),

  visitor_email: z.string()
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters')
    .trim()
    .toLowerCase()
    .optional(),

  visitor_phone: z.string()
    .max(20, 'Phone number must be less than 20 characters')
    .trim()
    .optional()
    .or(z.literal('')),

  group_size: z.union([
    z.string().transform(val => parseInt(val, 10)),
    z.number()
  ]).pipe(
    z.number()
      .int('Group size must be a whole number')
      .min(1, 'Group size must be at least 1')
      .max(50, 'Group size cannot exceed 50 people')
  ).optional(),

  preferred_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional()
    .or(z.literal('')),

  preferred_time: z.string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format')
    .optional()
    .or(z.literal('')),

  additional_info: z.string()
    .max(1000, 'Additional information must be less than 1000 characters')
    .trim()
    .optional()
    .or(z.literal('')),

  tshirt_request: z.union([
    z.string(),
    z.boolean()
  ]).optional(),

  tshirt_sizes: z.record(z.string(), z.union([
    z.string().transform(val => parseInt(val, 10)),
    z.number()
  ]).pipe(z.number().int().min(0).max(20)))
    .optional(),

  newsletter_signup: z.union([
    z.string(),
    z.boolean()
  ]).optional(),

  // Comma-separated guide IDs; '' clears all guides
  assigned_guide_id: z.string()
    .trim()
    .optional()
    .or(z.literal(''))
});

// Public Tour Registration schema
const PublicTourRegistrationSchema = z.object({
  public_tour_id: z.string().min(1, 'Tour ID is required'),
  
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  
  email: z.string()
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters')
    .trim()
    .toLowerCase(),
  
  group_size: z.union([
    z.string().transform(val => parseInt(val, 10)),
    z.number()
  ]).pipe(
    z.number()
      .int('Group size must be a whole number')
      .min(1, 'Group size must be at least 1')
      .max(20, 'Group size cannot exceed 20 people for public tours')
  ),
  
  phone: z.string()
    .max(20, 'Phone number must be less than 20 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  
  notes: z.string()
    .max(500, 'Notes must be less than 500 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  
  tshirt_request: z.union([
    z.string(),
    z.boolean()
  ]).optional(),
  
  tshirt_sizes: z.record(z.string(), z.union([
    z.string().transform(val => parseInt(val, 10)),
    z.number()
  ]).pipe(z.number().int().min(0).max(10)))
    .optional()
    .default({})
    .refine((sizes) => {
      const total = Object.values(sizes).reduce((sum, qty) => sum + qty, 0);
      return total <= 20;
    }, {
      message: 'Total t-shirt quantity cannot exceed 20. For larger orders, please visit our online store at https://www.aatwebstore.com/UMBOT/shop/home'
    }),
  
  newsletter_signup: z.union([
    z.string(),
    z.boolean()
  ]).optional()
});

// Tour Guide schema
const TourGuideSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  
  email: z.string()
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters')
    .trim()
    .toLowerCase(),
  
  phone: z.string()
    .max(20, 'Phone number must be less than 20 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  
  availability: z.string()
    .max(500, 'Availability must be less than 500 characters')
    .trim()
    .optional()
    .or(z.literal(''))
});

// Public Tour schema
const PublicTourSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters')
    .trim(),
  
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine(date => {
      const tourDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return tourDate >= today;
    }, 'Tour date must be today or in the future'),
  
  time: z.string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format'),
  
  type: z.string()
    .min(1, 'Type is required')
    .max(50, 'Type must be less than 50 characters')
    .trim(),
  
  capacity: z.union([
    z.string().transform(val => parseInt(val, 10)),
    z.number()
  ]).pipe(
    z.number()
      .int('Capacity must be a whole number')
      .min(1, 'Capacity must be at least 1')
      .max(100, 'Capacity cannot exceed 100 people')
  ),
  
  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .trim()
    .optional()
    .or(z.literal('')),

  // Supports multiple guides as comma-separated IDs (e.g., "guide1,guide2,guide3")
  assigned_guide_id: z.string()
    .trim()
    .optional()
    .or(z.literal(''))
});

// Guide Assignment schema - supports multiple guides as comma-separated IDs
const GuideAssignmentSchema = z.object({
  request_id: z.string().min(1, 'Request ID is required'),
  // Can be single ID or comma-separated IDs (e.g., "guide1" or "guide1,guide2,guide3")
  assigned_guide_id: z.string().nullable().optional()
});

// Status Update schema
const StatusUpdateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  status: z.enum(['pending', 'scheduled', 'completed', 'cancelled'], {
    errorMap: () => ({ message: 'Status must be pending, scheduled, completed, or cancelled' })
  })
});

// Validation helper function
function validateInput(schema, data) {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    const issues = error.errors.map(err => ({
      field: err.path.join('.') || 'unknown',
      message: err.message
    }));
    
    return {
      success: false,
      error: 'Validation failed',
      issues
    };
  }
}

// Export validation function and schemas
module.exports = {
  TourRequestSchema,
  TourRequestUpdateSchema,
  PublicTourRegistrationSchema,
  TourGuideSchema,
  PublicTourSchema,
  GuideAssignmentSchema,
  StatusUpdateSchema,
  validateInput
};