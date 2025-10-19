export interface HeaderProps {
    title: string
    subtitle: string
}

export default function Header({ title, subtitle }: HeaderProps) {
    return (
        <>
            <div class='p-4 border-b-1 border-zinc-200'>
                <h1 class='text-2xl font-bold'>{title}</h1>
                <h4 class='text-sm text-gray-600'>{subtitle}</h4>
            </div >
        </>
    )
}