import React, { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  UtensilsCrossed,
  ShoppingBag,
  Wallet,
  Users,
  UserCog,
  ChefHat,
  Calendar,
  ClipboardList,
  FileDown,
  ShieldPlus,
  CreditCard,
  LayoutDashboard,
  User,
  Bell,
  Receipt,
  BarChart3,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import Avatar from './Avatar';
import { classLabel } from '../utils/format';
import './Layout.css';

const CUSTOMER_ROLES = ['STUDENT', 'TEACHER', 'PARENT'];

const Layout = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const contentAreaRef = useRef(null);

  useEffect(() => {
    if (contentAreaRef.current) {
      contentAreaRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMenu = () => setMobileMenuOpen(false);

  const getNavLinks = () => {
    const commonLinks = [
      { to: '/menu',   icon: UtensilsCrossed, label: 'Menu' },
      { to: '/orders', icon: ShoppingBag,     label: 'My Orders' },
      { to: '/wallet', icon: Wallet,           label: 'Wallet' },
    ];
    const personalLinks = [
      { to: '/notifications', icon: Bell, label: 'Notifications' },
      { to: '/profile',       icon: User, label: 'Profile' },
    ];

    switch (role) {
      case 'STUDENT':
      case 'TEACHER':
        return [...commonLinks, ...personalLinks];
      case 'PARENT':
        return [...commonLinks, { to: '/children', icon: Users, label: 'My Wards' }, ...personalLinks];
      case 'CANTEEN_ADMIN':
        return [
          { to: '/admin/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
          { to: '/admin/daily-menu', icon: Calendar,        label: 'Meal of the Day' },
          { to: '/admin/fixed-menu', icon: ChefHat,         label: 'Daily Delights' },
          { to: '/admin/orders',     icon: ClipboardList,   label: 'Orders Board' },
          { to: '/admin/export',     icon: FileDown,        label: 'Export Orders' },
          { to: '/admin/accounts',   icon: UserCog,         label: 'Accounts' },
          { to: '/admin/expenses',   icon: Receipt,         label: 'Expenses' },
          { to: '/admin/reports',    icon: BarChart3,       label: 'Reports' },
          { to: '/admin/sub-admins', icon: ShieldPlus,      label: 'Sub Admins' },
          { to: '/admin/payment-settings', icon: CreditCard, label: 'Payment Settings' },
          { to: '/notifications',   icon: Bell,             label: 'Notifications' },
        ];
      case 'SUB_ADMIN':
        return [
          { to: '/subadmin/orders', icon: ClipboardList, label: 'Incoming Orders' },
          { to: '/subadmin/menu',   icon: ChefHat,        label: 'Menu Management' },
          { to: '/subadmin/export', icon: FileDown,       label: 'Export Orders' },
          { to: '/notifications',   icon: Bell,           label: 'Notifications' },
        ];
      default:
        return [];
    }
  };

  const initials = user?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  const subtitle =
    role === 'STUDENT'
      ? classLabel(user?.studentClass, user?.section)
      : role === 'PARENT'
        ? 'Parent'
        : role === 'TEACHER'
          ? 'Teacher'
          : '';

  if (CUSTOMER_ROLES.includes(role)) {
    const links = getNavLinks();
    const NavItems = ({ variant }) =>
      links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) => `tz-nav-item tz-nav-item-${variant} ${isActive ? 'active' : ''}`}
        >
          <link.icon size={variant === 'bottom' ? 22 : 18} />
          <span>{link.label}</span>
        </NavLink>
      ));

    return (
      <div className="tz-shell">
        <header className="tz-header">
          <div className="tz-brand">
            <ChefHat size={22} />
            <div className="tz-brand-text">
              <span className="tz-brand-name">
                Tuck<em>zone</em>
              </span>
              <span className="tz-brand-tagline">School Canteen &bull; Made Easy</span>
            </div>
          </div>

          <div className="tz-header-right">
            <div className="tz-user-chip">
              <Avatar name={user?.fullName} size={38} />
              <div className="tz-user-chip-text">
                <span className="tz-user-chip-name">{user?.fullName}</span>
                {subtitle && <span className="tz-user-chip-sub">{subtitle}</span>}
              </div>
            </div>
          </div>

          <nav className="tz-top-tabs">
            <NavItems variant="top" />
          </nav>
        </header>

        <div className="tz-content" ref={contentAreaRef}>
          <Outlet />
        </div>

        <nav className="tz-bottom-nav">
          <NavItems variant="bottom" />
        </nav>
      </div>
    );
  }

  const SidebarContent = () => (
    <>
      <div className="sidebar-header desktop-only">
        <UtensilsCrossed className="logo-icon" size={26} />
        <h2>School<span>Bite</span></h2>
      </div>

      <nav className="sidebar-nav">
        {getNavLinks().map((link) => (
          <NavLink 
            key={link.to} 
            to={link.to} 
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={closeMenu}
          >
            <link.icon className="nav-icon" size={18} />
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.fullName}</span>
            <span className="sidebar-user-role">{role?.replace('_', ' ')}</span>
          </div>
        </div>
        <button className="btn-logout" onClick={handleLogout}>
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="layout-container">
      {/* Mobile Header */}
      <div className="mobile-header">
        <div className="logo">
          <UtensilsCrossed size={22} />
          <span>TuckZone</span>
        </div>
        <button className="mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="top-header">
          <div className="header-title">TuckZone Canteen</div>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">{user?.fullName}</span>
              <span className="role-badge">{role?.replace('_', ' ')}</span>
            </div>
            <div className="avatar">{initials}</div>
          </div>
        </header>

        <div className="content-area" ref={contentAreaRef}>
          <Outlet />
        </div>
      </main>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-overlay" onClick={closeMenu}></div>
      )}
    </div>
  );
};

export default Layout;
