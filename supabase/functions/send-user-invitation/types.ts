
export interface UserInvitationRequest {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  clientName?: string;
}

export interface CompanyData {
  business_name?: string;
  email?: string;
  phone?: string;
}

export interface EmailTemplateData {
  businessName: string;
  supportEmail: string;
  fullName: string;
  email: string;
  roleLabel: string;
  clientName?: string;
  registerUrl: string;
  role: string;
  companyPhone?: string;
}
