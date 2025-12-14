import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile, UserRole, Permission } from '../types';
import { firebaseService } from '../services/firebaseService';

interface AuthContextValue {
    user: UserProfile | null;
    firebaseUser: FirebaseUser | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name: string, extra?: any) => Promise<void>;
    logout: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    hasPermission: (permission: Permission) => boolean;
    hasRole: (role: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const safetyTimer = setTimeout(() => {
            if (loading) {
                console.warn('Auth initialization timeout');
                setLoading(false);
            }
        }, 5000);

        const unsubscribe = firebaseService.subscribeToAuth((u) => {
            setUser(u);
            setFirebaseUser(u ? firebaseService.getCurrentUser() : null);
            setLoading(false);
            clearTimeout(safetyTimer);
        });

        return () => {
            unsubscribe();
            clearTimeout(safetyTimer);
        };
    }, []);

    const login = async (email: string, password: string) => {
        await firebaseService.login(email, password);
    };

    const register = async (email: string, password: string, name: string, extra?: any) => {
        await firebaseService.register(email, password, name, extra);
    };

    const logout = async () => {
        await firebaseService.logout();
        setUser(null);
        setFirebaseUser(null);
    };

    const resetPassword = async (email: string) => {
        await firebaseService.resetPassword(email);
    };

    const hasPermission = (permission: Permission): boolean => {
        if (!user) return false;
        // Get role permissions from Firebase or use defaults
        const rolePermissions = firebaseService.getRolePermissions();
        return rolePermissions.then(perms => {
            const userPerms = perms[user.role] || [];
            return userPerms.includes(permission);
        }).catch(() => false);
    };

    const hasRole = (role: UserRole | UserRole[]): boolean => {
        if (!user) return false;
        if (Array.isArray(role)) {
            return role.includes(user.role);
        }
        return user.role === role;
    };

    const value: AuthContextValue = {
        user,
        firebaseUser,
        loading,
        login,
        register,
        logout,
        resetPassword,
        hasPermission,
        hasRole,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
