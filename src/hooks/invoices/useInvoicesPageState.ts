import { useEffect, useReducer, useRef, useState } from 'react';
import { Invoice } from '@/types';
import { InvoicesProtectedDeleteDialogState } from '@/components/invoices/InvoicesProtectedDeleteDialog';

interface InvoiceFormState {
  showForm: boolean;
  editingInvoice: Invoice | null;
  preselectedClosureId: string | null;
}

interface InvoicesViewState {
  searchTerm: string;
  debouncedSearch: string;
  statusFilter: string;
  currentPage: number;
  activeTab: string;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  selectedInvoiceIds: string[];
  exportModalOpen: boolean;
  markAsPaidInvoice: Invoice | null;
}

type InvoicesViewAction =
  | { type: 'setSearchTerm'; payload: string }
  | { type: 'setDebouncedSearch'; payload: string }
  | { type: 'setStatusFilter'; payload: string }
  | { type: 'setCurrentPage'; payload: number }
  | { type: 'setActiveTab'; payload: string }
  | { type: 'setSort'; payload: { field: string } }
  | { type: 'setSelectedInvoiceIds'; payload: string[] }
  | { type: 'toggleInvoiceSelection'; payload: { invoiceId: string; checked: boolean } }
  | { type: 'setExportModalOpen'; payload: boolean }
  | { type: 'setMarkAsPaidInvoice'; payload: Invoice | null }
  | { type: 'clearSelection' };

const createInitialInvoicesViewState = (
  statusFromQuery: string | null,
  tabFromQuery: string,
): InvoicesViewState => ({
  searchTerm: '',
  debouncedSearch: '',
  statusFilter: statusFromQuery || 'all',
  currentPage: 1,
  activeTab: tabFromQuery,
  sortField: 'issueDate',
  sortDirection: 'desc',
  selectedInvoiceIds: [],
  exportModalOpen: false,
  markAsPaidInvoice: null,
});

const invoicesViewReducer = (
  state: InvoicesViewState,
  action: InvoicesViewAction,
): InvoicesViewState => {
  switch (action.type) {
    case 'setSearchTerm':
      return {
        ...state,
        searchTerm: action.payload,
        currentPage: 1,
        selectedInvoiceIds: [],
      };
    case 'setDebouncedSearch':
      return {
        ...state,
        debouncedSearch: action.payload,
      };
    case 'setStatusFilter':
      return {
        ...state,
        statusFilter: action.payload,
        currentPage: 1,
        selectedInvoiceIds: [],
      };
    case 'setCurrentPage':
      return {
        ...state,
        currentPage: action.payload,
        selectedInvoiceIds: [],
      };
    case 'setActiveTab':
      return {
        ...state,
        activeTab: action.payload,
      };
    case 'setSort':
      return {
        ...state,
        sortField: action.payload.field,
        sortDirection:
          state.sortField === action.payload.field
            ? state.sortDirection === 'asc'
              ? 'desc'
              : 'asc'
            : 'asc',
        currentPage: 1,
        selectedInvoiceIds: [],
      };
    case 'setSelectedInvoiceIds':
      return {
        ...state,
        selectedInvoiceIds: action.payload,
      };
    case 'toggleInvoiceSelection':
      return {
        ...state,
        selectedInvoiceIds: action.payload.checked
          ? [...state.selectedInvoiceIds, action.payload.invoiceId]
          : state.selectedInvoiceIds.filter((id) => id !== action.payload.invoiceId),
      };
    case 'setExportModalOpen':
      return {
        ...state,
        exportModalOpen: action.payload,
      };
    case 'setMarkAsPaidInvoice':
      return {
        ...state,
        markAsPaidInvoice: action.payload,
      };
    case 'clearSelection':
      return {
        ...state,
        selectedInvoiceIds: [],
      };
    default:
      return state;
  }
};

export const useInvoicesPageState = (
  statusFromQuery: string | null,
  tabFromQuery: string,
  preselectedClosureIdFromNavigation: string | null,
) => {
  const [viewState, dispatchView] = useReducer(
    invoicesViewReducer,
    createInitialInvoicesViewState(statusFromQuery, tabFromQuery),
  );
  const [formState, setFormState] = useState<InvoiceFormState>({
    showForm: false,
    editingInvoice: null,
    preselectedClosureId: null,
  });
  const pendingDeleteIdRef = useRef<string | null>(null);
  const [deleteDialogState, setDeleteDialogState] = useState<InvoicesProtectedDeleteDialogState>({
    isOpen: false,
    password: '',
    isVerifying: false,
    error: '',
    pendingFolio: '',
    pendingBatchDeleteIds: [],
  });

  const clearSelection = () => {
    dispatchView({ type: 'clearSelection' });
  };

  const handleSearchChange = (value: string) => {
    dispatchView({ type: 'setSearchTerm', payload: value });
  };

  const handleStatusFilterChange = (value: string) => {
    dispatchView({ type: 'setStatusFilter', payload: value });
  };

  const handlePageChange = (page: number) => {
    dispatchView({ type: 'setCurrentPage', payload: page });
  };

  const openCreateInvoiceForm = (preselectedId: string | null = null) => {
    setFormState({
      showForm: true,
      editingInvoice: null,
      preselectedClosureId: preselectedId,
    });
  };

  const openEditInvoiceForm = (invoice: Invoice) => {
    setFormState({
      showForm: true,
      editingInvoice: invoice,
      preselectedClosureId: null,
    });
  };

  const closeInvoiceForm = () => {
    setFormState({
      showForm: false,
      editingInvoice: null,
      preselectedClosureId: null,
    });
  };

  const openProtectedDeleteDialog = (options: {
    pendingDeleteId?: string | null;
    pendingFolio: string;
    pendingBatchDeleteIds?: string[];
  }) => {
    pendingDeleteIdRef.current = options.pendingDeleteId ?? null;
    setDeleteDialogState({
      isOpen: true,
      password: '',
      isVerifying: false,
      error: '',
      pendingFolio: options.pendingFolio,
      pendingBatchDeleteIds: options.pendingBatchDeleteIds ?? [],
    });
  };

  const closeProtectedDeleteDialog = () => {
    pendingDeleteIdRef.current = null;
    setDeleteDialogState({
      isOpen: false,
      password: '',
      isVerifying: false,
      error: '',
      pendingFolio: '',
      pendingBatchDeleteIds: [],
    });
  };

  const setDeletePassword = (password: string) => {
    setDeleteDialogState((prev) => ({
      ...prev,
      password,
      error: '',
    }));
  };

  const setDeleteError = (error: string) => {
    setDeleteDialogState((prev) => ({
      ...prev,
      error,
    }));
  };

  const setDeleteVerifying = (isVerifying: boolean) => {
    setDeleteDialogState((prev) => ({
      ...prev,
      isVerifying,
    }));
  };

  const handleSort = (field: string) => {
    dispatchView({ type: 'setSort', payload: { field } });
  };

  const setActiveTab = (value: string) => {
    dispatchView({ type: 'setActiveTab', payload: value });
  };

  const setExportModalOpen = (open: boolean) => {
    dispatchView({ type: 'setExportModalOpen', payload: open });
  };

  const setMarkAsPaidInvoice = (invoice: Invoice | null) => {
    dispatchView({ type: 'setMarkAsPaidInvoice', payload: invoice });
  };

  const setSelectedInvoiceIds = (invoiceIds: string[]) => {
    dispatchView({ type: 'setSelectedInvoiceIds', payload: invoiceIds });
  };

  const toggleInvoiceSelection = (invoiceId: string, checked: boolean) => {
    dispatchView({ type: 'toggleInvoiceSelection', payload: { invoiceId, checked } });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      dispatchView({ type: 'setDebouncedSearch', payload: viewState.searchTerm });
    }, 350);
    return () => clearTimeout(timer);
  }, [viewState.searchTerm]);

  useEffect(() => {
    if (!preselectedClosureIdFromNavigation) {
      return;
    }

    const timer = setTimeout(() => {
      openCreateInvoiceForm(preselectedClosureIdFromNavigation);
    }, 100);

    window.history.replaceState({}, document.title);

    return () => clearTimeout(timer);
  }, [preselectedClosureIdFromNavigation]);

  return {
    viewState,
    formState,
    deleteDialogState,
    pendingDeleteIdRef,
    clearSelection,
    handleSearchChange,
    handleStatusFilterChange,
    handlePageChange,
    openCreateInvoiceForm,
    openEditInvoiceForm,
    closeInvoiceForm,
    openProtectedDeleteDialog,
    closeProtectedDeleteDialog,
    setDeletePassword,
    setDeleteError,
    setDeleteVerifying,
    handleSort,
    setActiveTab,
    setExportModalOpen,
    setMarkAsPaidInvoice,
    setSelectedInvoiceIds,
    toggleInvoiceSelection,
  };
};
