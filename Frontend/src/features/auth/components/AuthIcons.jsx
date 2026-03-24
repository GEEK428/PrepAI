import React from "react"

const iconProps = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true
}

export const EmailIcon = () => (
    <svg {...iconProps}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
    </svg>
)

export const LockIcon = () => (
    <svg {...iconProps}>
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </svg>
)

export const UserIcon = () => (
    <svg {...iconProps}>
        <circle cx="12" cy="8" r="4" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
)

export const ArrowLeftIcon = () => (
    <svg {...iconProps}>
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
    </svg>
)

export const SparkIcon = () => (
    <svg {...iconProps}>
        <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" />
    </svg>
)
