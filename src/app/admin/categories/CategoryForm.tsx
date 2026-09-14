'use client'

import { useActionState } from 'react'
import type { Category } from '@prisma/client'
import { createCategoryAction, updateCategoryAction, type CategoryFormState } from './actions'
import { Field, Input, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'

const initialState: CategoryFormState = {}

export function CategoryForm({
  category,
  parentOptions,
}: {
  category?: Category
  parentOptions: { id: string; name: string }[]
}) {
  const action = category ? updateCategoryAction.bind(null, category.id) : createCategoryAction
  const [state, formAction, isPending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required defaultValue={category?.name} />
      </Field>

      <Field label="Slug" htmlFor="slug" hint="Leave blank to generate one from the name.">
        <Input id="slug" name="slug" defaultValue={category?.slug} placeholder="auto-generated" />
      </Field>

      <Field label="Parent category" htmlFor="parentId" hint="Optional — leave as None for a top-level category.">
        <Select id="parentId" name="parentId" defaultValue={category?.parentId ?? ''}>
          <option value="">None (top level)</option>
          {parentOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>
      </Field>

      {state.error && (
        <p role="alert" className="text-sm text-bad">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : category ? 'Save changes' : 'Create category'}
      </Button>
    </form>
  )
}
