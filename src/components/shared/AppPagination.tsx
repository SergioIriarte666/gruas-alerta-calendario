
import React from 'react';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";

interface AppPaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
}

export const AppPagination = ({ currentPage, totalPages, onPageChange, className }: AppPaginationProps) => {
    if (totalPages <= 1) return null;

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            onPageChange(page);
        }
    };

    const getPageNumbers = () => {
        const pageNumbers = new Set<number>();
        pageNumbers.add(1);
        if (totalPages > 1) pageNumbers.add(totalPages);
        pageNumbers.add(currentPage);
        if (currentPage > 1) pageNumbers.add(currentPage - 1);
        if (currentPage < totalPages) pageNumbers.add(currentPage + 1);

        const sortedPages = Array.from(pageNumbers).sort((a, b) => a - b);
        const result: (number | string)[] = [];

        let lastPage = 0;
        for (const page of sortedPages) {
            if (lastPage !== 0 && page - lastPage > 1) {
                result.push('...');
            }
            result.push(page);
            lastPage = page;
        }
        return result;
    };


    return (
        <Pagination className={className}>
            <PaginationContent>
                <PaginationItem>
                    <PaginationPrevious
                        href="#"
                        onClick={(e) => { e.preventDefault(); handlePageChange(currentPage - 1); }}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    />
                </PaginationItem>
                {getPageNumbers().map((page, index) =>
                    typeof page === 'number' ? (
                        <PaginationItem key={`${page}-${index}`}>
                            <PaginationLink
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handlePageChange(page);
                                }}
                                isActive={currentPage === page}
                                className="cursor-pointer"
                            >
                                {page}
                            </PaginationLink>
                        </PaginationItem>
                    ) : (
                        <PaginationItem key={`ellipsis-${index}`}>
                            <PaginationEllipsis />
                        </PaginationItem>
                    )
                )}
                <PaginationItem>
                    <PaginationNext
                        href="#"
                        onClick={(e) => { e.preventDefault(); handlePageChange(currentPage + 1); }}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    />
                </PaginationItem>
            </PaginationContent>
        </Pagination>
    );
};
