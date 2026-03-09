import Link from "next/link";

export default function SettingsPage() {
    return (
        <div className="min-h-screen bg-[#0C0C0C] text-white p-8">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold">Settings</h1>
                    <Link href="/" className="text-sm text-[#666] hover:text-white">
                        &larr; Dashboard
                    </Link>
                </div>
                <div className="bg-[#111] rounded-lg p-8 text-center text-[#666]">
                    <p>Settings configuration coming soon.</p>
                </div>
            </div>
        </div>
    );
}
