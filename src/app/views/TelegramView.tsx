import { TelegramGroupSettings } from '../../../components/settings/TelegramGroupSettings';

export default function TelegramView() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Telegram Integration</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage Telegram groups and view message logs
                    </p>
                </div>
            </div>

            <TelegramGroupSettings />
        </div>
    );
}
