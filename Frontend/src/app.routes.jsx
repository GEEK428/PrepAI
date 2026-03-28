import { createBrowserRouter } from "react-router";
import Login from "./features/auth/pages/Login";
import Register from "./features/auth/pages/Register";
import ForgotPassword from "./features/auth/pages/ForgotPassword";
import ResetPassword from "./features/auth/pages/ResetPassword";
import VerifyEmail from "./features/auth/pages/VerifyEmail";
import Protected from "./features/auth/components/Protected";
import ResumeAnalysis from "./features/interview/pages/ResumeAnalysis";
import Interview from "./features/interview/pages/Interview";
import ResumeOptimizer from "./features/interview/pages/ResumeOptimizer";
import Settings from "./features/interview/pages/Settings";
import Notes from "./features/interview/pages/Notes";
import ProgressTracker from "./features/interview/pages/ProgressTracker";
import Dashboard from "./features/interview/pages/Dashboard";



export const router = createBrowserRouter([
    {
        path: "/login",
        element: <Login />
    },
    {
        path: "/register",
        element: <Register />
    },
    {
        path: "/forgot-password",
        element: <ForgotPassword />
    },
    {
        path: "/reset-password/:token",
        element: <ResetPassword />
    },
    {
        path: "/verify-email/:token",
        element: <VerifyEmail />
    },
    {
        path: "/",
        element: <Protected><ResumeAnalysis /></Protected>
    },
    {
        path: "/resume-optimizer",
        element: <Protected><ResumeOptimizer /></Protected>
    },
    {
        path: "/resume-builder",
        element: <Protected><ResumeOptimizer /></Protected>
    },
    {
        path: "/settings",
        element: <Protected><Settings /></Protected>
    },
    {
        path: "/notes",
        element: <Protected><Notes /></Protected>
    },
    {
        path: "/progress-tracker",
        element: <Protected><ProgressTracker /></Protected>
    },
    {
        path: "/dashboard",
        element: <Protected><Dashboard /></Protected>
    },
    {
        path:"/interview/:interviewId",
        element: <Protected><Interview /></Protected>
    }
])
