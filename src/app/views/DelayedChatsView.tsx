import React from 'react';
import { DelayedChatReport } from '../../../components/reports/DelayedChatReport';

const DelayedChatsView: React.FC = () => {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Delayed Chats</h1>
            <DelayedChatReport />
        </div>
    );
};

export default DelayedChatsView;
