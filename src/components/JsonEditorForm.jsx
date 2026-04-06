import { useEffect } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

const schema = z.object({
  json: z.string().min(2, 'Informe um JSON valido'),
})

export function JsonEditorForm({
  title,
  description,
  initialValue,
  buttonLabel,
  onSubmit,
  isLoading,
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      json: initialValue,
    },
  })

  useEffect(() => {
    reset({ json: initialValue })
  }, [initialValue, reset])

  return (
    <form
      className="panel"
      onSubmit={handleSubmit((data) => onSubmit(data.json))}
    >
      <div className="panel-title-row">
        <h3>{title}</h3>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Processando...' : buttonLabel}
        </button>
      </div>
      <p>{description}</p>
      <textarea
        className="json-textarea"
        rows={12}
        spellCheck={false}
        {...register('json')}
      />
      {errors.json ? <span className="error">{errors.json.message}</span> : null}
    </form>
  )
}
