import React from 'react';
import { useEffect } from 'react'
import { LoginPageHeader } from '../cmps/login/login-page-header'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { googleLogin } from '../store/user.actions'
import { loadBoards } from '../store/board.actions'
import { GoogleLogin } from '@react-oauth/google'

export function LoginSignup() {
    const navigate = useNavigate()
    const boards = useSelector(storeState => storeState.boardModule.boards)

    useEffect(() => {
        if (!boards.length) loadBoards()
    }, [])

    async function onGoogleSuccess(credentialResponse) {
        try {
            if (!credentialResponse?.credential) return
            await googleLogin(credentialResponse.credential)
            if (boards?.[0]?._id) navigate(`/board/${boards[0]._id}`)
            else navigate('/')
        } catch (err) {
            console.log(err)
        }
    }

    return (
        // TODO: Change header to the original header(option)
        // TODO: Change label to p
        // TODO: fix image uplouder 
        <div className="login-signup">
            <LoginPageHeader />
            <div className="form-container layout">
                <h1>Log in to your account</h1>
                <p className="login-explain">Continue with Google</p>
                <div className="flex justify-center">
                    <GoogleLogin onSuccess={onGoogleSuccess} onError={() => console.log('Google login failed')} />
                </div>
            </div>
        </div>
    )
}
