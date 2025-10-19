import type { ComponentProps } from 'preact'

type Props = ComponentProps<'button'>

export default function Button({ class: c = '', ...rest }: Props) {
  return (
    <button
      class={`px-4 py-2 rounded-lg border bg-gray-900 text-white hover:opacity-90 ${c ?? ''}`}
      {...rest}
    />
  )
}
