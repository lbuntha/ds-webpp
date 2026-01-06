import React, { useState, useEffect } from 'react';
import { DailyAttendance, Employee } from '../../src/shared/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { getFriendlyErrorMessage } from '../../src/shared/utils/errorUtils';

interface Props {
    employees: Employee[];
    existingRecord?: DailyAttendance | null;
    onSave: (record: DailyAttendance) => Promise<void>;
    onCancel: () => void;
}

export const DailyAttendanceForm: React.FC<Props> = ({ employees, existingRecord, onSave, onCancel }) => {
    const [employeeId, setEmployeeId] = useState(existingRecord?.employeeId || '');
    const [employeeName, setEmployeeName] = useState(existingRecord?.employeeName || '');
    const [date, setDate] = useState(existingRecord?.date || new Date().toISOString().split('T')[0]);

    // Time Inputs (HH:mm)
    const [clockInTime, setClockInTime] = useState(existingRecord?.clockIn ? new Date(existingRecord.clockIn).toTimeString().slice(0, 5) : '08:00');
    const [clockOutTime, setClockOutTime] = useState(existingRecord?.clockOut ? new Date(existingRecord.clockOut).toTimeString().slice(0, 5) : '17:00');

    const [status, setStatus] = useState<DailyAttendance['status']>(existingRecord?.status || 'PRESENT');
    const [notes, setNotes] = useState(existingRecord?.notes || '');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (existingRecord) {
            setEmployeeId(existingRecord.employeeId);
            setEmployeeName(existingRecord.employeeName);
            setDate(existingRecord.date);
            if (existingRecord.clockIn) setClockInTime(new Date(existingRecord.clockIn).toTimeString().slice(0, 5));
            if (existingRecord.clockOut) setClockOutTime(new Date(existingRecord.clockOut).toTimeString().slice(0, 5));
            setStatus(existingRecord.status);
            setNotes(existingRecord.notes || '');
        }
    }, [existingRecord]);

    const handleEmployeeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setEmployeeId(id);
        const emp = employees.find(x => x.id === id);
        if (emp) setEmployeeName(emp.name);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!employeeId || !date || !clockInTime) {
            setError("Please fill required fields (Employee, Date, Clock In)");
            return;
        }

        setLoading(true);

        // Convert Time Strings to Timestamps
        const baseDate = new Date(date);
        const [inHours, inMinutes] = clockInTime.split(':').map(Number);
        const clockInTimestamp = new Date(baseDate.setHours(inHours, inMinutes)).getTime();

        let clockOutTimestamp: number | undefined = undefined;
        if (clockOutTime) {
            const [outHours, outMinutes] = clockOutTime.split(':').map(Number);
            clockOutTimestamp = new Date(baseDate.setHours(outHours, outMinutes)).getTime();
        }

        // Auto-detect status logic if not explicitly set to ABSENT
        let finalStatus = status;
        if (status !== 'ABSENT' && status !== 'LATE' && status !== 'LEFT_EARLY') {
            if (!clockOutTimestamp) {
                finalStatus = 'MISSING_CLOCK_OUT';
            } else {
                finalStatus = 'PRESENT';
            }
        }

        const record: DailyAttendance = {
            id: existingRecord?.id || `att-${Date.now()}`,
            employeeId,
            employeeName,
            date,
            clockIn: clockInTimestamp,
            clockOut: clockOutTimestamp,
            status: finalStatus,
            notes,
            isHoliday: false // Default
        };

        try {
            await onSave(record);
        } catch (e) {
            setError(getFriendlyErrorMessage(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card title={existingRecord ? "Edit Attendance Record" : "Manually Log Attendance"}>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100"
                            value={employeeId}
                            onChange={handleEmployeeChange}
                            required
                            disabled={!!existingRecord}
                        >
                            <option value="">Select Employee</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                        </select>
                    </div>

                    <Input
                        label="Date"
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        required
                        disabled={!!existingRecord}
                    />

                    <Input
                        label="Clock In Time"
                        type="time"
                        value={clockInTime}
                        onChange={e => setClockInTime(e.target.value)}
                        required
                    />

                    <Input
                        label="Clock Out Time"
                        type="time"
                        value={clockOutTime}
                        onChange={e => setClockOutTime(e.target.value)}
                    />

                    <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status Override</label>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 sm:text-sm"
                            value={status}
                            onChange={e => setStatus(e.target.value as any)}
                        >
                            <option value="PRESENT">Present (Regular)</option>
                            <option value="LATE">Late Arrival</option>
                            <option value="LEFT_EARLY">Left Early</option>
                            <option value="MISSING_CLOCK_OUT">Missing Clock Out</option>
                            <option value="ABSENT">Absent</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <Input
                            label="Notes"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Reason for lateness, manual adjustment, etc."
                        />
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <div className="flex justify-end space-x-3">
                    <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button type="submit" isLoading={loading}>Save Record</Button>
                </div>
            </form>
        </Card>
    );
};
