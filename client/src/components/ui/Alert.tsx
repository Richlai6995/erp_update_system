
import React from "react";

interface AlertProps {
    children: React.ReactNode;
    variant?: "default" | "destructive";
    className?: string;
}

export function Alert({ children, variant = "default", className = "" }: AlertProps) {
    const baseClasses = "p-4 rounded-lg flex items-start gap-3 border";
    const variantClasses =
        variant === "destructive"
            ? "bg-red-50 text-red-900 border-red-200"
            : "bg-blue-50 text-blue-900 border-blue-200";

    return <div className={`${baseClasses} ${variantClasses} ${className}`}>{children}</div>;
}

export function AlertDescription({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return <div className={`text-sm ${className}`}>{children}</div>;
}
