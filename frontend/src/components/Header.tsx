"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import NotificationBell from './NotificationBell';
import { ICONS } from '../page/home/ts/constants';

export default function Header({ searchQuery, onSearchChange, onSearchClick }: any) {
    const { user, logout } = useAuth();
    // Assuming role is accessible on user object. Adjust if role is nested or named differently.
    const isAdmin = String(user?.role).toUpperCase() === 'ADMIN';

    const [isScrolled, setIsScrolled] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 20);
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        window.addEventListener('scroll', handleScroll);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            window.removeEventListener('scroll', handleScroll);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <>
            <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none">
                <header
                    className={`pointer-events-auto flex items-center justify-between px-6 transition-all duration-500 ease-out border border-white/5 
                    ${isScrolled
                            ? 'mt-6 w-[90%] md:w-[80%] lg:w-[75%] h-14 rounded-2xl bg-[#0a0a0a]/80 backdrop-blur-xl backdrop-saturate-150 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.05)]'
                            : 'mt-0 w-full h-20 bg-transparent border-transparent'}`}
                >
                    {/* Logo Section */}
                    <div className="flex items-center gap-3 shrink-0">
                        <a href="/" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                <img src="/svg/logo.svg" alt="Monkframe Logo" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-xl font-bold tracking-tight text-white hidden sm:block">Monkframe</span>
                        </a>
                    </div>

                    {/* Desktop Navigation - Centered */}
                    <nav className="hidden lg:flex items-center gap-1 bg-transparent p-1 rounded-full">
                        {['Explore', 'Licenses', 'FAQ', 'Contact'].map((item) => (
                            <a
                                key={item}
                                href={item === 'Explore' ? '/' : `/${item.toLowerCase()}`}
                                className="px-4 py-1.5 rounded-full text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-all duration-300"
                            >
                                {item}
                            </a>
                        ))}
                    </nav>

                    {/* Actions Section */}
                    <div className="flex items-center gap-3">
                        {/* Expandable Search Bar */}


                        {/* Notifications */}
                        {user && <NotificationBell />}

                        {/* User Profile Dropdown */}
                        {user ? (
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-all group"
                                >
                                    <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow-lg group-hover:scale-105 transition-transform">
                                        {user.full_name ? user.full_name.charAt(0) : user.email?.charAt(0) || "U"}
                                    </div>
                                    <span className="text-xs font-bold text-white hidden sm:block">Account</span>
                                    <svg className={`w-3 h-3 text-zinc-500 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {isDropdownOpen && (
                                    <div className="absolute right-0 mt-3 w-56 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                        <div className="p-4 border-b border-white/5 bg-[#111]">
                                            <p className="text-xs font-bold text-white">{user.full_name || "User"}</p>
                                            <p className="text-[10px] text-zinc-500 mt-0.5">{user.email}</p>
                                        </div>
                                        <div className="p-1.5">
                                            {[
                                                { label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', href: '/profile' },
                                                ...(isAdmin ? [{ label: 'Dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z', href: '/dashboard' }] : [])
                                            ].map((item) => (
                                                <a key={item.label} href={item.href} className="flex items-center gap-3 px-3 py-2 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                                                    <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                                                    </svg>
                                                    {item.label}
                                                </a>
                                            ))}
                                            <div className="h-px bg-white/5 my-1.5" />
                                            <button
                                                onClick={() => logout()}
                                                className="w-full flex items-center gap-3 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                </svg>
                                                Logout
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-4">
                                <a href="/login" className="text-xs font-bold text-zinc-400 hover:text-white transition-colors">Log in</a>
                                <a href="/signup" className="px-5 py-2 rounded-full bg-white text-black text-xs font-bold hover:bg-gray-200 transition-all shadow-lg hover:shadow-xl hover:scale-105">
                                    Sign up
                                </a>
                            </div>
                        )}

                        {/* Mobile Menu Toggle */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="p-2 lg:hidden text-zinc-400 hover:text-white"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                            </svg>
                        </button>
                    </div>
                </header>
            </div>

            {/* Premium Mobile Menu Overlay */}
            <div className={`fixed inset-0 z-[90] lg:hidden transition-all duration-500 ${isMobileMenuOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'}`}>
                <div
                    className={`absolute inset-0 bg-black/60 backdrop-blur-2xl transition-opacity duration-500 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                />
                <div className={`absolute top-0 right-0 h-full w-[80%] max-w-sm bg-[#0a0a0a] border-l border-white/5 flex flex-col p-8 transition-transform duration-500 ease-out ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="mt-20 space-y-6">
                        {['Explore', 'Licenses', 'FAQ', 'Contact'].map((item, i) => (
                            <a
                                key={item}
                                href={item === 'Explore' ? '/' : `/${item.toLowerCase()}`}
                                className={`block text-2xl font-bold text-white hover:text-indigo-400 transition-colors transform ${isMobileMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
                                style={{ transitionDelay: `${i * 100}ms` }}
                            >
                                {item}
                            </a>
                        ))}
                    </div>
                    {user ? (
                        <div className="mt-auto pb-10 space-y-4">
                            <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl bg-white/5 border border-white/10">
                                <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-inner">
                                    {user.full_name ? user.full_name.charAt(0) : user.email?.charAt(0) || "U"}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">{user.full_name}</p>
                                    <p className="text-xs text-zinc-500">{user.email}</p>
                                </div>
                            </div>
                            <button onClick={() => logout()} className="w-full py-4 rounded-2xl bg-red-500/10 text-red-500 font-bold hover:bg-red-500/20 transition-all border border-red-500/20">Sign Out</button>
                        </div>
                    ) : (
                        <div className="mt-auto pb-10 space-y-4">
                            <a href="/signup" className="block w-full text-center py-4 rounded-2xl bg-white text-black font-bold">Get Started</a>
                            <a href="/login" className="block w-full text-center py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold">Sign In</a>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}




