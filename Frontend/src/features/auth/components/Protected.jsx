import React from "react";
import { Navigate } from "react-router";
import { useAuth } from "../hooks/useAuth";
import Loader from "../../../components/Loader";

const Protected = ({children}) => {
    const { loading, user } = useAuth()


    if(loading){
        return (<main className="auth-page"><Loader message="Initializing secure session..." /></main>)
    }

    if(!user){
        return <Navigate to={'/login'} />
    }
    
    return children
}

export default Protected