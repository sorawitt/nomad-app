import type { ComponentChildren } from 'preact';

interface NavBarProps {
    title: string;
    leftAction?: ComponentChildren;
    rightAction?: ComponentChildren;
}

export default function NavBar({ title, leftAction, rightAction }: NavBarProps) {
    return (
        <nav
            class="sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:border-b border-gray-200/60"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
            <div class="relative flex items-center justify-center py-4">
                {/* left back button */}
                {leftAction && (
                    <div class="absolute left-4 top-1/2 -translate-y-1/2">
                        {leftAction}
                    </div>
                )}

                <h1 class="text-base font-semibold text-gray-900">{title}</h1>

                {/* right action (optional) */}
                {rightAction && (
                    <div class="absolute right-4 top-1/2 -translate-y-1/2">
                        {rightAction}
                    </div>
                )}
            </div>
        </nav>
    );
}
