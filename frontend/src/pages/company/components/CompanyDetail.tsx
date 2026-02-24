import { useState, useCallback } from "react";
import type {
  CompanyWithRole,
  CompanyMember,
  CompanyInvitation,
  CompanyRoleInfo,
} from "@/entities/company";
import { companyApi } from "@/entities/company";
import type { BusinessCard } from "@/entities/business-card";
import {
  getRoleName,
  getRoleColor,
  isOwnerRole,
  canManageMembers,
  canInvite,
  canDeleteCompany,
  canChangeRoles,
} from "@/entities/company";
import {
  Typography,
  Avatar,
  Tag,
  Card,
  Button,
  Modal,
  Input,
  Loader,
  IconButton,
  CardDivider,
} from "@/shared";
import { useI18n } from "@/shared/config";
import { RoleSelect } from "./RoleSelect";
import { RolesManager } from "./RolesManager";
import "./CompanyDetail.scss";

type SubPage = "main" | "members" | "roles" | "privacy";

interface CompanyDetailProps {
  company: CompanyWithRole;
  members: CompanyMember[];
  invitations: CompanyInvitation[];
  isLoadingMembers: boolean;
  isLoadingInvitations: boolean;
  currentUserId?: string;
  userCards?: BusinessCard[];
  selectedCardId?: string | null;
  onSelectCard?: (cardId: string | null) => Promise<void>;
  onViewMemberCard?: (userId: string, cardId: string) => void;
  availableRoles?: CompanyRoleInfo[];
  onBack: () => void;
  onInvite: (email: string, roleId?: string) => Promise<void>;
  onCancelInvitation: (invitationId: string) => Promise<void>;
  onChangeRole: (userId: string, newRoleId: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onLeaveCompany: () => Promise<void>;
  onUpdateCompany: (data: {
    name: string;
    description: string;
  }) => Promise<void>;
  onDeleteCompany: () => Promise<void>;
  onRolesChange?: () => void;
}

export function CompanyDetail({
  company,
  members,
  invitations,
  isLoadingMembers,
  isLoadingInvitations,
  currentUserId,
  userCards = [],
  selectedCardId,
  onSelectCard,
  onViewMemberCard,
  availableRoles = [],
  onBack,
  onInvite,
  onCancelInvitation,
  onChangeRole,
  onRemoveMember,
  onLeaveCompany,
  onUpdateCompany,
  onDeleteCompany,
  onRolesChange,
}: CompanyDetailProps) {
  void isLoadingInvitations;
  void onViewMemberCard;
  const { t } = useI18n();
  const [subPage, setSubPage] = useState<SubPage>("main");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCardSelectModalOpen, setIsCardSelectModalOpen] = useState(false);
  const [isSelectingCard, setIsSelectingCard] = useState(false);
  const [selectedMemberForRole, setSelectedMemberForRole] =
    useState<CompanyMember | null>(null);
  const [isMemberActionLoading, setIsMemberActionLoading] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [isLoadingQR, setIsLoadingQR] = useState(false);

  const canManageRolesCheck = canChangeRoles(company.role);

  const defaultRole =
    availableRoles.find((r) => r.name === "Member") ||
    availableRoles[availableRoles.length - 1];

  const [inviteForm, setInviteForm] = useState({
    email: "",
    roleId: defaultRole?.id || "",
  });
  const [editForm, setEditForm] = useState({
    name: company.company.name,
    description: company.company.description || "",
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleShowQR = useCallback(async () => {
    setIsQRModalOpen(true);
    if (qrCodeImage) return;
    setIsLoadingQR(true);
    try {
      const data = await companyApi.getQRCode(company.company.id);
      setQrCodeImage(data.image_base64);
    } catch {
      // ignore
    } finally {
      setIsLoadingQR(false);
    }
  }, [company.company.id, qrCodeImage]);

  const handleInvite = async () => {
    if (!inviteForm.email.trim()) return;
    setIsSaving(true);
    try {
      await onInvite(inviteForm.email, inviteForm.roleId || undefined);
      setInviteForm({ email: "", roleId: defaultRole?.id || "" });
      setIsInviteModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateCompany = async () => {
    setIsSaving(true);
    try {
      await onUpdateCompany(editForm);
      setIsEditModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCompany = async () => {
    setIsSaving(true);
    try {
      await onDeleteCompany();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectCard = async (cardId: string | null) => {
    if (!onSelectCard) return;
    setIsSelectingCard(true);
    try {
      await onSelectCard(cardId);
      setIsCardSelectModalOpen(false);
    } finally {
      setIsSelectingCard(false);
    }
  };

  const selectedCard = userCards.find((c) => c.id === selectedCardId);

  const pendingInvitations = invitations.filter(
    (inv) => inv.status === "pending",
  );

  const pendingInvitationWithToken = pendingInvitations
    .filter((inv) => Boolean(inv.token))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];

  const canEditMemberRole = (member: CompanyMember): boolean => {
    return (
      canChangeRoles(company.role) &&
      member.user.id !== currentUserId &&
      !isOwnerRole(member.role)
    );
  };

  const handleCopyInviteLink = async () => {
    const token = pendingInvitationWithToken?.token;
    if (!token) {
      window.alert(t("companyDetail.createInviteFirst"));
      return;
    }

    const inviteLink = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = inviteLink;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    window.alert(t("companyDetail.inviteLinkCopied"));
  };

  const handleOpenMemberRoleSettings = (member: CompanyMember) => {
    if (!canEditMemberRole(member)) return;
    setSelectedMemberForRole(member);
  };

  const handleMemberRoleChange = async (roleId: string) => {
    if (!selectedMemberForRole) return;
    setIsMemberActionLoading(true);
    try {
      await onChangeRole(selectedMemberForRole.user.id, roleId);
      const nextRole =
        availableRoles.find((role) => role.id === roleId) || null;
      setSelectedMemberForRole({
        ...selectedMemberForRole,
        role: nextRole,
      });
    } finally {
      setIsMemberActionLoading(false);
    }
  };

  const handleMemberRemove = async () => {
    if (!selectedMemberForRole) return;
    setIsMemberActionLoading(true);
    try {
      await onRemoveMember(selectedMemberForRole.user.id);
      setSelectedMemberForRole(null);
    } finally {
      setIsMemberActionLoading(false);
    }
  };

  // Build nav items
  const navItems: { id: SubPage; label: string; icon?: React.ReactNode }[] = [
    {
      id: "members",
      label: t("companyDetail.members"),
      icon: (
        <svg
          width="40"
          height="40"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            width="32"
            height="32"
            rx="8.96"
            fill="url(#paint0_linear_1045_22963)"
          />
          <path
            d="M14.884 22.8006C14.298 22.8006 13.8882 22.7125 13.6548 22.5362C13.4213 22.3647 13.3046 22.1146 13.3046 21.7859C13.3046 21.3237 13.4428 20.8401 13.7191 20.3351C14.0002 19.8301 14.4028 19.3561 14.9269 18.913C15.4557 18.4699 16.0917 18.1102 16.8349 17.8339C17.5782 17.5576 18.4119 17.4194 19.3362 17.4194C20.2652 17.4194 21.1013 17.5576 21.8446 17.8339C22.5878 18.1102 23.2214 18.4699 23.7455 18.913C24.2743 19.3561 24.6793 19.8301 24.9604 20.3351C25.2415 20.8401 25.382 21.3237 25.382 21.7859C25.382 22.1146 25.2629 22.3647 25.0247 22.5362C24.7913 22.7125 24.3815 22.8006 23.7955 22.8006H14.884ZM19.3433 16.1473C18.8193 16.1473 18.3381 16.0068 17.8998 15.7257C17.4662 15.4446 17.1184 15.0659 16.8564 14.5894C16.5943 14.113 16.4633 13.5794 16.4633 12.9886C16.4633 12.4074 16.5943 11.8833 16.8564 11.4164C17.1232 10.9448 17.4757 10.5708 17.914 10.2944C18.3524 10.0181 18.8288 9.87995 19.3433 9.87995C19.8626 9.87995 20.3391 10.0157 20.7726 10.2873C21.2109 10.5589 21.5611 10.9305 21.8231 11.4021C22.0899 11.869 22.2233 12.3931 22.2233 12.9743C22.2233 13.5699 22.0899 14.1082 21.8231 14.5894C21.5611 15.0659 21.2109 15.4446 20.7726 15.7257C20.3391 16.0068 19.8626 16.1473 19.3433 16.1473ZM7.14442 22.8006C6.66323 22.8006 6.32258 22.703 6.12248 22.5076C5.92238 22.3171 5.82233 22.0455 5.82233 21.693C5.82233 21.207 5.9462 20.7139 6.19395 20.2136C6.44169 19.7086 6.79424 19.2441 7.25161 18.8201C7.71375 18.3961 8.2664 18.0531 8.90958 17.791C9.55752 17.529 10.2817 17.398 11.0821 17.398C11.73 17.398 12.3089 17.4837 12.8187 17.6552C13.3332 17.822 13.7882 18.0316 14.1836 18.2841C13.7787 18.6033 13.4285 18.9654 13.1331 19.3704C12.8377 19.7706 12.609 20.1827 12.447 20.6067C12.2898 21.026 12.2112 21.4262 12.2112 21.8073C12.2112 22.1932 12.3065 22.5243 12.4971 22.8006H7.14442ZM11.0821 16.3117C10.6295 16.3117 10.2126 16.1902 9.83147 15.9472C9.45032 15.6995 9.14541 15.3684 8.91673 14.9539C8.68804 14.5346 8.5737 14.0701 8.5737 13.5603C8.5737 13.0506 8.68804 12.5932 8.91673 12.1882C9.15017 11.7785 9.45747 11.4545 9.83861 11.2163C10.2198 10.9733 10.6342 10.8519 11.0821 10.8519C11.5299 10.8519 11.9444 10.971 12.3256 11.2092C12.7115 11.4426 13.0188 11.7642 13.2474 12.1739C13.4761 12.5789 13.5905 13.0363 13.5905 13.5461C13.5905 14.0654 13.4761 14.5346 13.2474 14.9539C13.0188 15.3684 12.7138 15.6995 12.3327 15.9472C11.9516 16.1902 11.5347 16.3117 11.0821 16.3117Z"
            fill="white"
          />
          <defs>
            <linearGradient
              id="paint0_linear_1045_22963"
              x1="16"
              y1="0"
              x2="16"
              y2="32"
              gradientUnits="userSpaceOnUse"
            >
              <stop stop-color="#7AE481" />
              <stop offset="1" stop-color="#34C73E" />
            </linearGradient>
          </defs>
        </svg>
      ),
    },
  ];
  if (canManageRolesCheck) {
    navItems.push({
      id: "roles",
      label: t("companyDetail.roles"),
      icon: (
        <svg
          width="40"
          height="40"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            width="32"
            height="32"
            rx="8.96"
            fill="url(#paint0_linear_1045_22946)"
          />
          <path
            d="M12.6 21.6194C11.5118 21.9118 10.5226 21.9441 9.63226 21.7161C8.74194 21.4925 7.9828 21.0323 7.35484 20.3355C6.72688 19.6387 6.26237 18.7247 5.96129 17.5935L4.75484 13.0581C4.5828 12.4086 4.6172 11.8774 4.85806 11.4645C5.10323 11.0473 5.55054 10.7527 6.2 10.5806L12.6258 8.87097C13.271 8.69892 13.8043 8.73118 14.2258 8.96774C14.6516 9.2043 14.9484 9.64086 15.1161 10.2774L16.329 14.8194C16.6387 15.9548 16.6946 16.9806 16.4968 17.8968C16.2989 18.8086 15.871 19.5849 15.2129 20.2258C14.5548 20.8667 13.6839 21.3312 12.6 21.6194ZM11.9484 19.1677C12.628 18.9828 13.172 18.6495 13.5806 18.1677C13.9892 17.686 14.2086 17.1269 14.2387 16.4903C14.243 16.357 14.2 16.2667 14.1097 16.2194C14.0194 16.172 13.9161 16.1892 13.8 16.271C13.4645 16.5075 13.0817 16.7161 12.6516 16.8968C12.2258 17.0731 11.828 17.2108 11.4581 17.3097C11.0796 17.4129 10.6559 17.4946 10.1871 17.5548C9.72258 17.6108 9.28817 17.6215 8.88387 17.5871C8.74624 17.5742 8.64946 17.6108 8.59355 17.6968C8.54194 17.7785 8.55269 17.8731 8.62581 17.9806C8.96559 18.5226 9.43441 18.9011 10.0323 19.1161C10.6344 19.3269 11.2731 19.3441 11.9484 19.1677ZM8.72258 14.9613C8.86882 14.9226 8.9957 14.914 9.10323 14.9355C9.21075 14.957 9.30538 14.9806 9.3871 15.0065C9.46882 15.0323 9.54839 15.0323 9.62581 15.0065C9.67742 14.9892 9.71398 14.9462 9.73548 14.8774C9.75699 14.8086 9.75269 14.7226 9.72258 14.6194C9.64946 14.3527 9.48817 14.1484 9.23871 14.0065C8.98925 13.8645 8.72473 13.828 8.44516 13.8968C8.16129 13.9699 7.94409 14.1333 7.79355 14.3871C7.64731 14.6366 7.6129 14.8968 7.69032 15.1677C7.71613 15.2667 7.75484 15.3419 7.80645 15.3935C7.86237 15.4409 7.91613 15.4602 7.96774 15.4516C8.03656 15.443 8.09677 15.4086 8.14839 15.3484C8.2043 15.2839 8.27312 15.2151 8.35484 15.1419C8.43656 15.0688 8.55914 15.0086 8.72258 14.9613ZM12.6323 13.9032C12.7828 13.8645 12.9097 13.8559 13.0129 13.8774C13.1204 13.8946 13.2151 13.9183 13.2968 13.9484C13.3785 13.9742 13.4581 13.9742 13.5355 13.9484C13.5871 13.9312 13.6237 13.8882 13.6452 13.8194C13.6667 13.7505 13.6624 13.6645 13.6323 13.5613C13.5591 13.2946 13.3979 13.0903 13.1484 12.9484C12.9032 12.8021 12.6387 12.7656 12.3548 12.8387C12.0753 12.9118 11.8602 13.0753 11.7097 13.329C11.5634 13.5785 11.529 13.8387 11.6065 14.1097C11.6366 14.2043 11.6774 14.2774 11.729 14.329C11.7806 14.3806 11.8301 14.4 11.8774 14.3871C11.9462 14.3785 12.0065 14.3441 12.0581 14.2839C12.114 14.2237 12.1828 14.157 12.2645 14.0839C12.3505 14.0108 12.4731 13.9505 12.6323 13.9032ZM25.3161 12.2581C25.9656 12.4344 26.4129 12.7312 26.6581 13.1484C26.9075 13.5613 26.9462 14.0903 26.7742 14.7355L25.5484 19.2645C25.243 20.3914 24.7763 21.3032 24.1484 22C23.5204 22.6968 22.7634 23.1591 21.8774 23.3871C20.9914 23.6151 20.0086 23.5849 18.929 23.2968C18.1849 23.0989 17.5355 22.8108 16.9806 22.4323C16.4258 22.0581 15.9849 21.6108 15.6581 21.0903C16.5097 20.3462 17.0774 19.4151 17.3613 18.2968C17.6452 17.1742 17.6043 15.9355 17.2387 14.5806L16.4903 11.7613L16.5548 11.529C16.7355 11.043 17.0258 10.7183 17.4258 10.5548C17.8301 10.3871 18.3204 10.3828 18.8968 10.5419L25.3161 12.2581ZM18.7613 16.3032C18.9849 16.3634 19.1979 16.3376 19.4 16.2258C19.6022 16.1097 19.7355 15.9398 19.8 15.7161C19.8602 15.4925 19.8301 15.2796 19.7097 15.0774C19.5936 14.871 19.4237 14.7376 19.2 14.6774C18.972 14.6172 18.757 14.6452 18.5548 14.7613C18.3527 14.8774 18.2215 15.0473 18.1613 15.271C18.1011 15.5032 18.129 15.7204 18.2452 15.9226C18.3656 16.1204 18.5376 16.2473 18.7613 16.3032ZM22.5484 17.3161C22.7763 17.3763 22.9892 17.3484 23.1871 17.2323C23.3892 17.1161 23.5226 16.9462 23.5871 16.7226C23.6473 16.4946 23.6194 16.2796 23.5032 16.0774C23.3871 15.8753 23.2151 15.7462 22.9871 15.6903C22.7591 15.6301 22.5441 15.6581 22.3419 15.7742C22.1441 15.886 22.0151 16.0538 21.9548 16.2774C21.8946 16.5054 21.9226 16.7204 22.0387 16.9226C22.1548 17.1247 22.3247 17.2559 22.5484 17.3161ZM19.8387 19.7935C20.1785 19.8839 20.4925 20.0129 20.7806 20.1806C21.0731 20.3484 21.3742 20.5699 21.6839 20.8452C21.7828 20.9312 21.8796 20.9527 21.9742 20.9097C22.0731 20.8667 22.1183 20.7806 22.1097 20.6516C22.0882 20.1398 21.9032 19.686 21.5548 19.2903C21.2065 18.8946 20.7527 18.6258 20.1936 18.4839C19.828 18.3806 19.471 18.3505 19.1226 18.3935C18.7742 18.4366 18.4538 18.5462 18.1613 18.7226C17.8688 18.8946 17.6301 19.1247 17.4452 19.4129C17.3763 19.5118 17.372 19.6043 17.4323 19.6903C17.4968 19.7763 17.5936 19.8065 17.7226 19.7806C18.1183 19.6946 18.486 19.6538 18.8258 19.6581C19.1699 19.6581 19.5075 19.7032 19.8387 19.7935Z"
            fill="white"
          />
          <defs>
            <linearGradient
              id="paint0_linear_1045_22946"
              x1="16"
              y1="0"
              x2="16"
              y2="32"
              gradientUnits="userSpaceOnUse"
            >
              <stop stop-color="#C885FF" />
              <stop offset="1" stop-color="#9F2DFC" />
            </linearGradient>
          </defs>
        </svg>
      ),
    });
  }
  if (canManageMembers(company.role)) {
    navItems.push({
      id: "privacy",
      label: t("companyDetail.privacy"),
      icon: (
        <svg
          width="40"
          height="40"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            width="32"
            height="32"
            rx="8.96"
            fill="url(#paint0_linear_1045_22955)"
          />
          <path
            d="M11.5826 25.2243C10.9037 25.2243 10.3886 25.0397 10.0372 24.6705C9.68586 24.3072 9.51017 23.7593 9.51017 23.0268V16.6933C9.51017 15.9667 9.68586 15.4218 10.0372 15.0586C10.3886 14.6953 10.9037 14.5136 11.5826 14.5136H19.9439C20.6228 14.5136 21.138 14.6953 21.4893 15.0586C21.8407 15.4218 22.0164 15.9667 22.0164 16.6933V23.0268C22.0164 23.7593 21.8407 24.3072 21.4893 24.6705C21.138 25.0397 20.6228 25.2243 19.9439 25.2243H11.5826ZM11.1449 15.264V12.4233C11.1449 11.3216 11.3593 10.4015 11.7881 9.66303C12.2228 8.91861 12.7916 8.35881 13.4943 7.98362C14.197 7.60843 14.9534 7.42084 15.7633 7.42084C16.5732 7.42084 17.3295 7.60843 18.0323 7.98362C18.735 8.35881 19.3007 8.91861 19.7295 9.66303C20.1643 10.4015 20.3816 11.3216 20.3816 12.4233V15.264H18.7112V12.2536C18.7112 11.5568 18.5742 10.9702 18.3003 10.4938C18.0323 10.0114 17.6749 9.64516 17.2283 9.39503C16.7816 9.14491 16.2933 9.01985 15.7633 9.01985C15.2333 9.01985 14.7449 9.14491 14.2983 9.39503C13.8516 9.64516 13.4943 10.0114 13.2263 10.4938C12.9583 10.9702 12.8243 11.5568 12.8243 12.2536V15.264H11.1449Z"
            fill="white"
          />
          <defs>
            <linearGradient
              id="paint0_linear_1045_22955"
              x1="16"
              y1="0"
              x2="16"
              y2="32"
              gradientUnits="userSpaceOnUse"
            >
              <stop stop-color="#FFC574" />
              <stop offset="1" stop-color="#FF9400" />
            </linearGradient>
          </defs>
        </svg>
      ),
    });
  }

  // ——— Sub-page rendering ———
  if (subPage !== "main") {
    const subPageTitles: Record<SubPage, string> = {
      main: "",
      members: t("companyDetail.members"),
      roles: t("companyDetail.roles"),
      privacy: t("companyDetail.privacy"),
    };

    return (
      <div className="company-detail">
        {/* Sub-page Top Bar */}
        <div className="company-detail__topbar">
          <IconButton
            aria-label={t("company.back")}
            onClick={() => setSubPage("main")}
          >
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
              <path
                d="M9 1L1 9L9 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
          <div className="company-detail__topbar-title">
            <span>{subPageTitles[subPage]}</span>
          </div>
          <div style={{ width: 36 }} />
        </div>

        <div className="company-detail__content">
          {/* Members Sub-page */}
          {subPage === "members" && (
            <div className="company-detail__section">
              <div className="company-detail__hero">
                <div className="company-detail__hero-logo">
                  {company.company.logo_url ? (
                    <img
                      src={company.company.logo_url}
                      alt={company.company.name}
                    />
                  ) : (
                    <span className="company-detail__hero-logo-letter">
                      {company.company.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="company-detail__hero-info">
                  <h1 className="company-detail__hero-name">
                    {company.company.name}
                  </h1>
                  <div className="company-detail__hero-domain">
                    @{company.company.company_id}
                  </div>
                </div>

                <div className="company-detail__hero-stats">
                  <div className="company-detail__hero-stat company-detail__hero-stat--members">
                    {t("companyDetail.membersCount", {
                      count: String(members.length),
                    })}
                  </div>
                  <div
                    className="company-detail__hero-stat company-detail__hero-stat--role"
                    style={{
                      backgroundColor: company.role
                        ? `${getRoleColor(company.role)}15`
                        : undefined,
                      borderColor: company.role
                        ? `${getRoleColor(company.role)}30`
                        : undefined,
                      color: company.role
                        ? getRoleColor(company.role)
                        : undefined,
                    }}
                  >
                    {isOwnerRole(company.role) && "👑 "}
                    {getRoleName(company.role)}
                  </div>
                </div>
              </div>

              <Card className="company-detail__members-card">
                {canInvite(company.role) && (
                  <div className="company-detail__members-actions">
                    <button
                      className="company-detail__invite-btn"
                      onClick={() => setIsInviteModalOpen(true)}
                    >
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 32 32"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M12 25V23C12 21.9391 12.4214 20.9217 13.1716 20.1716C13.9217 19.4214 14.9391 19 16 19H22C23.0609 19 24.0783 19.4214 24.8284 20.1716C25.5786 20.9217 26 21.9391 26 23V25M9 12V18M6 15H12M15 11C15 13.2091 16.7909 15 19 15C21.2091 15 23 13.2091 23 11C23 8.79086 21.2091 7 19 7C16.7909 7 15 8.79086 15 11Z"
                          stroke="#0081FF"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>

                      <span>Invite member</span>
                    </button>
                    <button
                      className="company-detail__invite-btn company-detail__invite-btn"
                      onClick={handleCopyInviteLink}
                    >
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 32 32"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M17.4144 21.6565L16.0002 23.0707C15.0625 24.0084 13.7907 24.5352 12.4646 24.5352C11.1385 24.5352 9.86677 24.0084 8.92909 23.0707C7.99141 22.133 7.46462 20.8612 7.46462 19.5352C7.46462 18.2091 7.99141 16.9373 8.92909 15.9996L10.3433 14.5854M14.5859 10.3428L16.0002 8.92855C16.9378 7.99087 18.2096 7.46409 19.5357 7.46409C20.8618 7.46409 22.1335 7.99087 23.0712 8.92855C24.0089 9.86624 24.5357 11.138 24.5357 12.4641C24.5357 13.7902 24.0089 15.0619 23.0712 15.9996L21.657 17.4138M13.1717 18.828L18.8286 13.1712"
                          stroke="#0081FF"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>

                      <span>Invite via link</span>
                    </button>
                  </div>
                )}

                {canManageMembers(company.role) &&
                  pendingInvitations.length > 0 && (
                    <div className="company-detail__members-group">
                      <span className="company-detail__section-title">
                        Pending ({pendingInvitations.length})
                      </span>
                      <div className="company-detail__members-list">
                        {pendingInvitations.map((inv) => (
                          <div
                            key={inv.id}
                            className="company-detail__member-item"
                          >
                            <div className="company-detail__member-row">
                              <div className="company-detail__member-avatar company-detail__member-avatar--invite">
                                @
                              </div>
                              <div className="company-detail__member-info">
                                <span className="company-detail__member-name">
                                  {inv.email}
                                </span>
                                <Tag
                                  size="sm"
                                  style={{
                                    backgroundColor: inv.role
                                      ? `${getRoleColor(inv.role)}15`
                                      : undefined,
                                    borderColor: inv.role
                                      ? getRoleColor(inv.role)
                                      : undefined,
                                    color: inv.role
                                      ? getRoleColor(inv.role)
                                      : undefined,
                                  }}
                                >
                                  {getRoleName(inv.role)}
                                </Tag>
                              </div>
                              <button
                                className="company-detail__member-action company-detail__member-action--cancel"
                                onClick={() => onCancelInvitation(inv.id)}
                                title="Cancel invitation"
                              >
                                x
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                <div className="company-detail__members-group">
                  {isLoadingMembers ? (
                    <div className="company-detail__loading">
                      <Loader />
                    </div>
                  ) : (
                    <div className="company-detail__members-list">
                      {members.map((member) => {
                        const isRoleEditable = canEditMemberRole(member);
                        return (
                          <div
                            key={member.id}
                            className="company-detail__member-item"
                          >
                            <div className="company-detail__member-row">
                              <Avatar
                                src={member.user.avatar_url || undefined}
                                initials={`${member.user.first_name.charAt(0)}${member.user.last_name.charAt(0)}`}
                                size="sm"
                              />
                              <div className="company-detail__member-info">
                                <span className="company-detail__member-name">
                                  {member.user.first_name}{" "}
                                  {member.user.last_name}
                                </span>
                                <span className="company-detail__member-email">
                                  {isOwnerRole(member.role)
                                    ? t("companyDetail.owner")
                                    : getRoleName(member.role)}
                                </span>
                              </div>
                              <div className="company-detail__member-role">
                                {isRoleEditable && (
                                  <button
                                    type="button"
                                    className="company-detail__member-open-role"
                                    onClick={() =>
                                      handleOpenMemberRoleSettings(member)
                                    }
                                    aria-label={t(
                                      "companyDetail.openRoleSettings",
                                    )}
                                  >
                                    <svg
                                      className="company-detail__member-arrow"
                                      width="8"
                                      height="14"
                                      viewBox="0 0 8 14"
                                      fill="none"
                                    >
                                      <path
                                        d="M1 1L7 7L1 13"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Roles Sub-page */}
          {subPage === "roles" && canManageRolesCheck && (
            <div className="company-detail__section">
              <RolesManager
                companyId={company.company.id}
                canManageRoles={canManageRolesCheck}
                onRolesChange={onRolesChange}
              />
            </div>
          )}

          {/* Privacy Sub-page */}
          {subPage === "privacy" && canManageMembers(company.role) && (
            <div className="company-detail__section">
              <Card className="company-detail__card">
                <span className="company-detail__card-label">
                  {t("companyDetail.companyInfo")}
                </span>
                <div className="company-detail__settings-rows">
                  <div className="company-detail__settings-row">
                    <span className="company-detail__settings-label">
                      {t("companyDetail.name")}
                    </span>
                    <span className="company-detail__settings-value">
                      {company.company.name}
                    </span>
                  </div>
                  <div className="company-detail__settings-row">
                    <span className="company-detail__settings-label">ID</span>
                    <span className="company-detail__settings-value">
                      @{company.company.company_id}
                    </span>
                  </div>
                  <div className="company-detail__settings-row">
                    <span className="company-detail__settings-label">
                      {t("companyDetail.description")}
                    </span>
                    <span className="company-detail__settings-value">
                      {company.company.description || "—"}
                    </span>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditForm({
                      name: company.company.name,
                      description: company.company.description || "",
                    });
                    setIsEditModalOpen(true);
                  }}
                >
                  {t("companyDetail.edit")}
                </Button>
              </Card>

              {canDeleteCompany(company.role) && (
                <Card className="company-detail__card company-detail__card--danger">
                  <span className="company-detail__card-label company-detail__card-label--danger">
                    {t("companyDetail.dangerZone")}
                  </span>
                  <p className="company-detail__card-hint">
                    {t("companyDetail.deleteWarning")}
                  </p>
                  <Button
                    variant="danger"
                    onClick={() => setIsDeleteModalOpen(true)}
                  >
                    {t("companyDetail.deleteCompany")}
                  </Button>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Modals also available in sub-pages */}
        <Modal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          title={t("companyDetail.inviteMember")}
        >
          <div className="invite-form">
            <Input
              label="Email"
              type="email"
              value={inviteForm.email}
              onChange={(e) =>
                setInviteForm({ ...inviteForm, email: e.target.value })
              }
              placeholder="user@example.com"
            />
            <div className="form-field">
              <label>{t("companyDetail.roleForInvitee")}</label>
              <RoleSelect
                roles={availableRoles}
                selectedRoleId={inviteForm.roleId}
                onChange={(roleId) => setInviteForm({ ...inviteForm, roleId })}
                excludeOwner={true}
              />
            </div>
            <div className="form-actions">
              <Button
                variant="ghost"
                onClick={() => setIsInviteModalOpen(false)}
              >
                {t("companyDetail.cancel")}
              </Button>
              <Button
                onClick={handleInvite}
                disabled={isSaving || !inviteForm.email.trim()}
              >
                {isSaving
                  ? t("companyDetail.sending")
                  : t("companyDetail.send")}
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={Boolean(selectedMemberForRole)}
          onClose={() => setSelectedMemberForRole(null)}
          title={t("companyDetail.memberRoleSettings")}
        >
          {selectedMemberForRole && (
            <div className="member-role-form">
              <div className="form-field">
                <label>{t("companyDetail.memberLabel")}</label>
                <div className="member-role-form__name">
                  {selectedMemberForRole.user.first_name}{" "}
                  {selectedMemberForRole.user.last_name}
                </div>
              </div>
              <div className="form-field">
                <label>{t("companyDetail.roleLabel")}</label>
                <RoleSelect
                  roles={availableRoles.filter((role) => !isOwnerRole(role))}
                  selectedRoleId={selectedMemberForRole.role?.id || ""}
                  onChange={handleMemberRoleChange}
                />
              </div>
              <div className="form-actions">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedMemberForRole(null)}
                >
                  {t("companyDetail.close")}
                </Button>
                <Button
                  variant="danger"
                  onClick={handleMemberRemove}
                  disabled={isMemberActionLoading}
                >
                  {isMemberActionLoading
                    ? t("companyDetail.removing")
                    : t("companyDetail.removeMember")}
                </Button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={t("companyDetail.editCompany")}
        >
          <div className="edit-company-form">
            <Input
              label={t("company.companyName")}
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
            />
            <Input
              label={t("companyDetail.description")}
              value={editForm.description}
              onChange={(e) =>
                setEditForm({ ...editForm, description: e.target.value })
              }
            />
            <div className="form-actions">
              <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>
                {t("companyDetail.cancel")}
              </Button>
              <Button onClick={handleUpdateCompany} disabled={isSaving}>
                {isSaving ? t("companyDetail.saving") : t("companyDetail.save")}
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title={t("companyDetail.deleteCompanyTitle")}
        >
          <div className="delete-confirm">
            <Typography variant="body">
              {t("companyDetail.deleteConfirm", { name: company.company.name })}
            </Typography>
            <Typography variant="small" color="secondary">
              {t("companyDetail.deleteIrreversible")}
            </Typography>
            <div className="form-actions">
              <Button
                variant="ghost"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                {t("companyDetail.cancel")}
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteCompany}
                disabled={isSaving}
              >
                {isSaving
                  ? t("companyDetail.deleting")
                  : t("companyDetail.delete")}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ——— Main page ———
  return (
    <div className="company-detail">
      {/* Top Bar */}
      <div className="company-detail__topbar">
        <IconButton aria-label={t("company.back")} onClick={onBack}>
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path
              d="M9 1L1 9L9 17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
        <div className="company-detail__topbar-title">
          <span>{company.company.name}</span>
        </div>
        {canManageMembers(company.role) ? (
          <IconButton
            aria-label={t("companyDetail.settings")}
            onClick={() => {
              setEditForm({
                name: company.company.name,
                description: company.company.description || "",
              });
              setIsEditModalOpen(true);
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </IconButton>
        ) : (
          <div style={{ width: 36 }} />
        )}
      </div>

      {/* Content */}
      <div className="company-detail__content">
        {/* Hero Block */}
        <div className="company-detail__hero">
          <div className="company-detail__hero-logo">
            {company.company.logo_url ? (
              <img src={company.company.logo_url} alt={company.company.name} />
            ) : (
              <span className="company-detail__hero-logo-letter">
                {company.company.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="company-detail__hero-info">
            <h1 className="company-detail__hero-name">
              {company.company.name}
            </h1>
            <div className="company-detail__hero-domain">
              @{company.company.company_id}
            </div>
          </div>

          {/* Stats */}
          <div className="company-detail__hero-stats">
            <div className="company-detail__hero-stat company-detail__hero-stat--members">
              {t("companyDetail.membersCount", {
                count: String(members.length),
              })}
            </div>
            <div
              className="company-detail__hero-stat company-detail__hero-stat--role"
              style={{
                backgroundColor: company.role
                  ? `${getRoleColor(company.role)}15`
                  : undefined,
                borderColor: company.role
                  ? `${getRoleColor(company.role)}30`
                  : undefined,
                color: company.role ? getRoleColor(company.role) : undefined,
              }}
            >
              {isOwnerRole(company.role) && "👑 "}
              {getRoleName(company.role)}
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="company-detail__cards">
          <Card
            className="company-detail__card"
            variant="interactive"
            onClick={handleShowQR}
          >
            {/* Company ID card with QR button */}
            <div className="company-detail__card-row">
              <div className="company-detail__card-content">
                <span className="company-detail__card-label">
                  {t("companyDetail.shareLink")}
                </span>
                <span className="company-detail__card-value">
                  @{company.company.company_id}
                </span>
              </div>
              <span className="company-detail__card-icon company-detail__card-icon--qr">
                <svg width="20" height="20" viewBox="0 0 120 120" fill="none">
                  <path
                    d="M13.8104 54.9865C9.18531 54.9865 5.71654 53.8302 3.40402 51.5177C1.13433 49.2052 -0.000521637 45.6508 -0.000521637 40.8544V14.0678C-0.000521637 9.27143 1.13433 5.73842 3.40402 3.46872C5.71654 1.15621 9.18531 -5.26756e-05 13.8104 -5.26756e-05H41.1109C45.736 -5.26756e-05 49.2047 1.15621 51.5172 3.46872C53.8298 5.73842 54.986 9.27143 54.986 14.0678V40.8544C54.986 45.6508 53.8298 49.2052 51.5172 51.5177C49.2047 53.8302 45.736 54.9865 41.1109 54.9865H13.8104ZM13.6176 44.7729H41.3036C42.4599 44.7729 43.3378 44.4731 43.9373 43.8736C44.5369 43.274 44.8366 42.3747 44.8366 41.1756V13.6823C44.8366 12.4833 44.5369 11.6054 43.9373 11.0486C43.3378 10.4491 42.4599 10.1493 41.3036 10.1493H13.6176C12.4614 10.1493 11.5835 10.4491 10.9839 11.0486C10.4272 11.6054 10.1489 12.4833 10.1489 13.6823V41.1756C10.1489 42.3747 10.4272 43.274 10.9839 43.8736C11.5835 44.4731 12.4614 44.7729 13.6176 44.7729ZM21.7115 34.5592C20.8121 34.5592 20.3625 34.0239 20.3625 32.9533V21.8404C20.3625 20.8554 20.8121 20.363 21.7115 20.363H33.1456C34.0877 20.363 34.5588 20.8554 34.5588 21.8404V32.9533C34.5588 34.0239 34.0877 34.5592 33.1456 34.5592H21.7115ZM78.8178 54.9865C74.1928 54.9865 70.724 53.8302 68.4115 51.5177C66.099 49.2052 64.9427 45.6508 64.9427 40.8544V14.0678C64.9427 9.27143 66.099 5.73842 68.4115 3.46872C70.724 1.15621 74.1928 -5.26756e-05 78.8178 -5.26756e-05H106.118C110.743 -5.26756e-05 114.191 1.15621 116.46 3.46872C118.773 5.73842 119.929 9.27143 119.929 14.0678V40.8544C119.929 45.6508 118.773 49.2052 116.46 51.5177C114.191 53.8302 110.743 54.9865 106.118 54.9865H78.8178ZM78.6251 44.7729H106.311C107.51 44.7729 108.388 44.4731 108.945 43.8736C109.502 43.274 109.78 42.3747 109.78 41.1756V13.6823C109.78 12.4833 109.502 11.6054 108.945 11.0486C108.388 10.4491 107.51 10.1493 106.311 10.1493H78.6251C77.426 10.1493 76.5267 10.4491 75.9272 11.0486C75.3704 11.6054 75.0921 12.4833 75.0921 13.6823V41.1756C75.0921 42.3747 75.3704 43.274 75.9272 43.8736C76.5267 44.4731 77.426 44.7729 78.6251 44.7729ZM86.9759 34.5592C86.1622 34.5592 85.7554 34.0239 85.7554 32.9533V21.8404C85.7554 20.8554 86.1622 20.363 86.9759 20.363H98.4742C99.4164 20.363 99.8874 20.8554 99.8874 21.8404V32.9533C99.8874 34.0239 99.4164 34.5592 98.4742 34.5592H86.9759ZM13.8104 119.93C9.18531 119.93 5.71654 118.773 3.40402 116.461C1.13433 114.191 -0.000521637 110.658 -0.000521637 105.862V79.011C-0.000521637 74.2575 1.13433 70.7245 3.40402 68.4119C5.71654 66.0994 9.18531 64.9432 13.8104 64.9432H41.1109C45.736 64.9432 49.2047 66.0994 51.5172 68.4119C53.8298 70.7245 54.986 74.2575 54.986 79.011V105.862C54.986 110.658 53.8298 114.191 51.5172 116.461C49.2047 118.773 45.736 119.93 41.1109 119.93H13.8104ZM13.6176 109.78H41.3036C42.4599 109.78 43.3378 109.481 43.9373 108.881C44.5369 108.281 44.8366 107.404 44.8366 106.247V78.6898C44.8366 77.4907 44.5369 76.5914 43.9373 75.9919C43.3378 75.3923 42.4599 75.0926 41.3036 75.0926H13.6176C12.4614 75.0926 11.5835 75.3923 10.9839 75.9919C10.4272 76.5914 10.1489 77.4907 10.1489 78.6898V106.247C10.1489 107.404 10.4272 108.281 10.9839 108.881C11.5835 109.481 12.4614 109.78 13.6176 109.78ZM21.7115 99.5667C20.8121 99.5667 20.3625 99.0314 20.3625 97.9608V86.8479C20.3625 85.8629 20.8121 85.3704 21.7115 85.3704H33.1456C34.0877 85.3704 34.5588 85.8629 34.5588 86.8479V97.9608C34.5588 99.0314 34.0877 99.5667 33.1456 99.5667H21.7115ZM69.5035 82.0943C68.6042 82.0943 68.1545 81.5805 68.1545 80.5527V69.4397C68.1545 68.4548 68.6042 67.9623 69.5035 67.9623H80.9376C81.8369 67.9623 82.2866 68.4548 82.2866 69.4397V80.5527C82.2866 81.5805 81.8369 82.0943 80.9376 82.0943H69.5035ZM103.87 82.0943C102.971 82.0943 102.521 81.5805 102.521 80.5527V69.4397C102.521 68.4548 102.971 67.9623 103.87 67.9623H115.304C116.204 67.9623 116.653 68.4548 116.653 69.4397V80.5527C116.653 81.5805 116.204 82.0943 115.304 82.0943H103.87ZM86.8474 99.374C85.9481 99.374 85.4984 98.8387 85.4984 97.7681V86.6551C85.4984 85.6702 85.9481 85.1777 86.8474 85.1777H98.2815C99.1808 85.1777 99.6305 85.6702 99.6305 86.6551V97.7681C99.6305 98.8387 99.1808 99.374 98.2815 99.374H86.8474ZM69.5035 116.525C68.6042 116.525 68.1545 116.011 68.1545 114.983V103.806C68.1545 102.821 68.6042 102.329 69.5035 102.329H80.9376C81.8369 102.329 82.2866 102.821 82.2866 103.806V114.983C82.2866 116.011 81.8369 116.525 80.9376 116.525H69.5035ZM103.87 116.525C102.971 116.525 102.521 116.011 102.521 114.983V103.806C102.521 102.821 102.971 102.329 103.87 102.329H115.304C116.204 102.329 116.653 102.821 116.653 103.806V114.983C116.653 116.011 116.204 116.525 115.304 116.525H103.87Z"
                    fill="currentColor"
                    fill-opacity="0.3"
                  ></path>
                </svg>
              </span>
            </div>

            {/* Description */}
            {company.company.description && (
              <>
                <CardDivider />
                <span className="company-detail__card-label">
                  {t("companyDetail.aboutCompany")}
                </span>
                <p className="company-detail__card-text">
                  {company.company.description}
                </p>
              </>
            )}
          </Card>

          {/* My business card in company */}
          {userCards.length > 0 && (
            <Card
              className="company-detail__card"
              variant="interactive"
              onClick={() => setIsCardSelectModalOpen(true)}
            >
              <div className="company-detail__card-row">
                <div className="company-detail__card-content">
                  <span className="company-detail__card-label">
                    {t("companyDetail.myCard")}
                  </span>
                  <span className="company-detail__card-value">
                    {selectedCard
                      ? `📇 ${selectedCard.title}`
                      : t("companyDetail.notSelected")}
                  </span>
                </div>
                <svg
                  className="company-detail__nav-item-arrow"
                  width="8"
                  height="14"
                  viewBox="0 0 8 14"
                  fill="none"
                >
                  <path
                    d="M1 1L7 7L1 13"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </Card>
          )}

          {/* Role & permissions card */}
          <Card className="company-detail__card">
            <span className="company-detail__card-label">
              {t("companyDetail.yourRole")}
            </span>
            <div className="company-detail__role-badge">
              <span
                className="company-detail__role-dot"
                style={{ backgroundColor: getRoleColor(company.role) }}
              />
              <span className="company-detail__role-name">
                {isOwnerRole(company.role) && "👑 "}
                {getRoleName(company.role)}
              </span>
            </div>
            <div className="company-detail__permissions">
              {canInvite(company.role) && (
                <span className="company-detail__perm-tag company-detail__perm-tag--active">
                  ✓ {t("companyDetail.invites")}
                </span>
              )}
              {canManageMembers(company.role) && (
                <span className="company-detail__perm-tag company-detail__perm-tag--active">
                  ✓ {t("companyDetail.management")}
                </span>
              )}
              {canDeleteCompany(company.role) && (
                <span className="company-detail__perm-tag company-detail__perm-tag--active">
                  ✓ {t("companyDetail.deletion")}
                </span>
              )}
              {!canInvite(company.role) && (
                <span className="company-detail__perm-tag">
                  {t("companyDetail.viewOnly")}
                </span>
              )}
            </div>
          </Card>
        </div>

        {/* Navigation Buttons */}
        <div className="company-detail__nav-list">
          {navItems.map((item) => (
            <button
              key={item.id}
              className="company-detail__nav-item"
              onClick={() => setSubPage(item.id)}
            >
              {item.icon && item.icon}
              <span className="company-detail__nav-item-label">
                {item.label}
              </span>
              <svg
                className="company-detail__nav-item-arrow"
                width="8"
                height="14"
                viewBox="0 0 8 14"
                fill="none"
              >
                <path
                  d="M1 1L7 7L1 13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </div>

        {/* Leave button */}
        {!canDeleteCompany(company.role) && (
          <button
            className="company-detail__leave-btn"
            onClick={onLeaveCompany}
          >
            {t("companyDetail.leaveCompany")}
          </button>
        )}
      </div>

      {/* ——— MODALS ——— */}

      {/* Invite Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title={t("companyDetail.inviteMember")}
      >
        <div className="invite-form">
          <Input
            label="Email"
            type="email"
            value={inviteForm.email}
            onChange={(e) =>
              setInviteForm({ ...inviteForm, email: e.target.value })
            }
            placeholder="user@example.com"
          />
          <div className="form-field">
            <label>{t("companyDetail.roleForInvitee")}</label>
            <RoleSelect
              roles={availableRoles}
              selectedRoleId={inviteForm.roleId}
              onChange={(roleId) => setInviteForm({ ...inviteForm, roleId })}
              excludeOwner={true}
            />
          </div>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setIsInviteModalOpen(false)}>
              {t("companyDetail.cancel")}
            </Button>
            <Button
              onClick={handleInvite}
              disabled={isSaving || !inviteForm.email.trim()}
            >
              {isSaving ? t("companyDetail.sending") : t("companyDetail.send")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t("companyDetail.editCompany")}
      >
        <div className="edit-company-form">
          <Input
            label={t("company.companyName")}
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <Input
            label={t("companyDetail.description")}
            value={editForm.description}
            onChange={(e) =>
              setEditForm({ ...editForm, description: e.target.value })
            }
          />
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>
              {t("companyDetail.cancel")}
            </Button>
            <Button onClick={handleUpdateCompany} disabled={isSaving}>
              {isSaving ? t("companyDetail.saving") : t("companyDetail.save")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t("companyDetail.deleteCompanyTitle")}
      >
        <div className="delete-confirm">
          <Typography variant="body">
            {t("companyDetail.deleteConfirm", { name: company.company.name })}
          </Typography>
          <Typography variant="small" color="secondary">
            {t("companyDetail.deleteIrreversible")}
          </Typography>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              {t("companyDetail.cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteCompany}
              disabled={isSaving}
            >
              {isSaving
                ? t("companyDetail.deleting")
                : t("companyDetail.delete")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Card Select Modal */}
      <Modal
        isOpen={isCardSelectModalOpen}
        onClose={() => setIsCardSelectModalOpen(false)}
        title={t("companyDetail.selectCard")}
      >
        <div className="card-select-modal">
          <Typography variant="body" color="secondary">
            {t("companyDetail.selectCardHint", { name: company.company.name })}
          </Typography>
          <div className="card-select-modal__list">
            {userCards.map((card) => (
              <button
                key={card.id}
                className={`card-select-modal__item ${
                  selectedCardId === card.id
                    ? "card-select-modal__item--selected"
                    : ""
                }`}
                onClick={() => handleSelectCard(card.id)}
                disabled={isSelectingCard}
              >
                <div className="card-select-modal__item-icon">📇</div>
                <div className="card-select-modal__item-info">
                  <span className="card-select-modal__item-title">
                    {card.title}
                    {card.is_primary && (
                      <span className="card-select-modal__item-badge">★</span>
                    )}
                  </span>
                  <span className="card-select-modal__item-bio">
                    {card.ai_generated_bio ||
                      card.bio ||
                      t("companyDetail.noDescription")}
                  </span>
                </div>
                {selectedCardId === card.id && (
                  <span className="card-select-modal__item-check">✓</span>
                )}
              </button>
            ))}
          </div>
          {selectedCardId && (
            <button
              className="card-select-modal__clear"
              onClick={() => handleSelectCard(null)}
              disabled={isSelectingCard}
            >
              {t("companyDetail.clearSelection")}
            </button>
          )}
        </div>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        title="QR Code"
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            padding: 16,
          }}
        >
          {isLoadingQR ? (
            <Loader />
          ) : qrCodeImage ? (
            <>
              <img
                src={qrCodeImage}
                alt="Company QR Code"
                style={{ width: 220, height: 220, borderRadius: 12 }}
              />
              <div style={{ fontSize: 16, fontWeight: 500, opacity: 0.7 }}>
                @{company.company.company_id}
              </div>
            </>
          ) : (
            <div style={{ opacity: 0.5 }}>Failed to load QR code</div>
          )}
        </div>
      </Modal>
    </div>
  );
}
