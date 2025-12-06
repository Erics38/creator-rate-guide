/**
 * Input Validation Schemas
 *
 * Uses Zod for runtime type checking and validation
 * Prevents injection attacks, invalid data, and type errors
 */

import { z } from 'zod';

/**
 * Schema for creating a new collaboration
 * Validates all required fields with appropriate constraints
 */
export const createCollaborationSchema = z.object({
  // Creator information
  creatorName: z.string()
    .min(1, 'Creator name is required')
    .max(100, 'Creator name must be less than 100 characters')
    .trim()
    .regex(/^[a-zA-Z0-9\s@._-]+$/, 'Creator name contains invalid characters'),

  // Input parameters (what user entered)
  averageViews: z.number()
    .int('Average views must be a whole number')
    .min(0, 'Average views cannot be negative')
    .max(10_000_000_000, 'Average views is unreasonably high'),

  lowestViews: z.number()
    .int('Lowest views must be a whole number')
    .min(0, 'Lowest views cannot be negative')
    .max(10_000_000_000, 'Lowest views is unreasonably high'),

  targetCPM: z.number()
    .min(0, 'Target CPM cannot be negative')
    .max(1000, 'Target CPM is unreasonably high'),

  // Prediction results (from algorithm)
  projectedViews: z.number()
    .int('Projected views must be a whole number')
    .min(0, 'Projected views cannot be negative'),

  recommendedPrice: z.number()
    .min(0, 'Recommended price cannot be negative')
    .max(1_000_000, 'Recommended price is unreasonably high'),

  confidence: z.number()
    .min(0, 'Confidence must be at least 0%')
    .max(100, 'Confidence cannot exceed 100%'),

  reasoning: z.string()
    .min(1, 'Reasoning is required')
    .max(1000, 'Reasoning must be less than 1000 characters'),

  priceRange: z.object({
    min: z.number().min(0, 'Price range minimum cannot be negative'),
    max: z.number().min(0, 'Price range maximum cannot be negative'),
  }).refine(
    (data) => data.max >= data.min,
    'Price range maximum must be greater than or equal to minimum'
  ),

  // Optional fields (if provided)
  actualViews: z.number().int().min(0).optional(),
  actualPrice: z.number().min(0).optional(),
  datePosted: z.string().datetime().optional(),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
  accuracy: z.number().min(0).max(100).optional(),
});

/**
 * Schema for updating an existing collaboration
 * All fields optional (partial update)
 */
export const updateCollaborationSchema = z.object({
  actualViews: z.number().int().min(0).optional(),
  actualPrice: z.number().min(0).optional(),
  datePosted: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  accuracy: z.number().min(0).max(100).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  'At least one field must be provided for update'
);

/**
 * Type exports for TypeScript
 */
export type CreateCollaborationInput = z.infer<typeof createCollaborationSchema>;
export type UpdateCollaborationInput = z.infer<typeof updateCollaborationSchema>;
