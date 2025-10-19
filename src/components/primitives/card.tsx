export function Card(props: any) {
  return <div class={`bg-white rounded-xl shadow ${props.class ?? ''}`}>{props.children}</div>
}
