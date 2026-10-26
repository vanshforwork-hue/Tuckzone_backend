import React, { useEffect, useRef } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
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
  Calculator,
} from 'lucide-react';
import Avatar from './Avatar';
import { classLabel } from '../utils/format';
import './Layout.css';

const Layout = () => {
  const { user, role } = useAuth();
  const location = useLocation();
  const contentAreaRef = useRef(null);

  useEffect(() => {
    if (contentAreaRef.current) {
      contentAreaRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

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
          { to: '/billing',          icon: Calculator,      label: 'Billing / POS' },
          { to: '/admin/orders',     icon: ClipboardList,   label: 'Orders Board' },
          { to: '/admin/export',     icon: FileDown,        label: 'Export Orders' },
          { to: '/admin/accounts',   icon: UserCog,         label: 'Accounts' },
          { to: '/admin/expenses',   icon: Receipt,         label: 'Expenses' },
          { to: '/admin/reports',    icon: BarChart3,       label: 'Reports' },
          { to: '/admin/sub-admins', icon: ShieldPlus,      label: 'Sub Admins' },
          { to: '/admin/payment-settings', icon: CreditCard, label: 'Payment Settings' },
          ...personalLinks,
        ];
      case 'SUB_ADMIN':
        return [
          { to: '/subadmin/orders', icon: ClipboardList, label: 'Incoming Orders' },
          { to: '/billing',         icon: Calculator,    label: 'Billing / POS' },
          { to: '/subadmin/menu',   icon: ChefHat,        label: 'Menu Management' },
          { to: '/subadmin/export', icon: FileDown,       label: 'Export Orders' },
          ...personalLinks,
        ];
      default:
        return [];
    }
  };

  const subtitle =
    role === 'STUDENT'
      ? classLabel(user?.studentClass, user?.section)
      : role === 'PARENT'
        ? 'Parent'
        : role === 'TEACHER'
          ? 'Teacher'
          : role === 'CANTEEN_ADMIN'
            ? 'Canteen Admin'
            : role === 'SUB_ADMIN'
              ? 'Sub Admin'
              : '';

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
};

export default Layout;
