'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, PlusCircle } from 'lucide-react';
import { Select2, Select2Option } from './Select2';

export type FieldType = 'text' | 'number' | 'email' | 'textarea' | 'select2' | 'boolean';

export interface DynamicFormField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: Select2Option[];
  isMulti?: boolean;
  disabled?: boolean;
  defaultValue?: any;
  hint?: string;
}

export interface DynamicCrudModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  title: string;
  fields: DynamicFormField[];
  initialData?: Record<string, any> | null;
  onSubmit: (formData: Record<string, any>, mode: 'create' | 'edit') => Promise<void>;
  onClose: () => void;
  submitButtonText?: string;
  onFieldChange?: (fieldName: string, value: any, currentFormData: Record<string, any>) => void;
}

export function DynamicCrudModal({
  isOpen,
  mode,
  title,
  fields,
  initialData,
  onSubmit,
  onClose,
  submitButtonText,
  onFieldChange,
}: DynamicCrudModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const wasOpenRef = React.useRef<boolean>(false);

  // Initialize or reset form values based on mode and initialData
  useEffect(() => {
    if (isOpen) {
      const isFreshOpen = !wasOpenRef.current;
      wasOpenRef.current = true;

      if (isFreshOpen) {
        setSubmitError(null);
        setErrors({});
        const initial: Record<string, any> = {};

        fields.forEach((field) => {
          if (mode === 'edit' && initialData && initialData[field.name] !== undefined) {
            initial[field.name] = initialData[field.name];
          } else {
            initial[field.name] = field.defaultValue !== undefined ? field.defaultValue : (field.type === 'boolean' ? false : '');
          }
        });

        // Preserve ID if editing
        if (mode === 'edit' && initialData?.id) {
          initial.id = initialData.id;
        }

        setFormData(initial);
      } else {
        // Modal is already open, preserve user entries and merge any new default field keys
        setFormData((prev) => {
          const merged = { ...prev };
          fields.forEach((field) => {
            if (merged[field.name] === undefined) {
              merged[field.name] = field.defaultValue !== undefined ? field.defaultValue : (field.type === 'boolean' ? false : '');
            }
          });
          return merged;
        });
      }
    } else {
      wasOpenRef.current = false;
      setFormData({});
    }
  }, [isOpen, mode, initialData, fields]);

  if (!isOpen) return null;

  const handleChange = (fieldName: string, value: any) => {
    const nextFormData = { ...formData, [fieldName]: value };
    setFormData(nextFormData);
    if (errors[fieldName]) {
      setErrors((prev) => ({ ...prev, [fieldName]: '' }));
    }
    if (onFieldChange) {
      onFieldChange(fieldName, value, nextFormData);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    fields.forEach((field) => {
      if (field.required) {
        const val = formData[field.name];
        if (val === undefined || val === null || val === '') {
          newErrors[field.name] = `${field.label} is required`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onSubmit(formData, mode);
      onClose();
    } catch (err: any) {
      setSubmitError(err?.message || 'Operation failed. Please verify the inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultButtonLabel = mode === 'create' ? 'Create Record' : 'Save Changes';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl overflow-hidden rounded-t-2xl sm:rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] transition-colors duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 dark:bg-slate-950/70">
          <div className="flex items-center gap-2">
            {mode === 'create' ? (
              <PlusCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            ) : (
              <Save className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            )}
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
              {title || (mode === 'create' ? 'Create New Entry' : 'Edit Entry')}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {submitError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs">
              {submitError}
            </div>
          )}

          {fields.map((field) => {
            const hasError = !!errors[field.name];

            return (
              <div key={field.name} className="space-y-1">
                {field.type !== 'select2' && field.type !== 'boolean' && (
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    {field.label} {field.required && <span className="text-rose-500">*</span>}
                  </label>
                )}

                {/* Text / Email / Number */}
                {(field.type === 'text' || field.type === 'email' || field.type === 'number') && (
                  <input
                    type={field.type}
                    value={formData[field.name] ?? ''}
                    disabled={field.disabled}
                    onChange={(e) =>
                      handleChange(
                        field.name,
                        field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                      )
                    }
                    placeholder={field.placeholder}
                    className={`w-full rounded-lg border px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 transition-all ${
                      hasError
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/20 focus:ring-rose-500'
                        : 'border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950/80 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                  />
                )}

                {/* Textarea */}
                {field.type === 'textarea' && (
                  <textarea
                    rows={3}
                    value={formData[field.name] ?? ''}
                    disabled={field.disabled}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    className={`w-full rounded-lg border px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 transition-all ${
                      hasError
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/20 focus:ring-rose-500'
                        : 'border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950/80 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                  />
                )}

                {/* Generic Select2 dropdown */}
                {field.type === 'select2' && (
                  <Select2
                    label={field.label}
                    options={field.options || []}
                    value={formData[field.name]}
                    onChange={(val) => handleChange(field.name, val)}
                    placeholder={field.placeholder || `Select ${field.label}...`}
                    isMulti={field.isMulti}
                    error={errors[field.name]}
                    disabled={field.disabled}
                  />
                )}

                {/* Boolean / Switch */}
                {field.type === 'boolean' && (
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="checkbox"
                      id={field.name}
                      checked={!!formData[field.name]}
                      onChange={(e) => handleChange(field.name, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor={field.name} className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      {field.label}
                    </label>
                  </div>
                )}

                {field.hint && <p className="text-[11px] text-slate-500">{field.hint}</p>}
                {hasError && field.type !== 'select2' && (
                  <p className="text-xs text-rose-500">{errors[field.name]}</p>
                )}
              </div>
            );
          })}

          {/* Modal Footer */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-50 cursor-pointer text-center"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>{submitButtonText || defaultButtonLabel}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
