import { useState } from "preact/hooks";
import { useAuth } from "../../hooks/useAuth";

export default function AuthScreen() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      await signInWithGoogle();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ไม่สามารถเข้าสู่ระบบด้วย Google"
      );
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div class="max-w-md w-full">
        <div class="bg-white rounded-xl shadow-lg p-6 md:p-8 space-y-6">
          {/* Header */}
          <div class="text-center">
            <h1 class="text-2xl font-bold text-gray-900">Trip Planner</h1>
            <p class="text-sm text-gray-600 mt-2">
              เข้าสู่ระบบเพื่อจัดการทริปของคุณ
            </p>
          </div>

          {error && <p class="text-sm text-red-600 mt-1">{error}</p>}
          {/* Divider */}
          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-300"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white text-gray-500">หรือ</span>
            </div>
          </div>

          {/* Google Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            class="w-full bg-white border border-gray-300 text-gray-700 font-medium py-3 rounded-lg hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            🔐 เข้าสู่ระบบด้วย Google
          </button>
        </div>
      </div>
    </div>
  );
}
