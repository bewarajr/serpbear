import { renderHook, waitFor } from '@testing-library/react';
import mockRouter from 'next-router-mock';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

import { useFetchDomains } from '../../services/domains';
import { dummyDomain } from '../../__mocks__/data';

jest.mock('next/router', () => jest.requireActual('next-router-mock'));

fetchMock.mockIf(`${window.location.origin}/api/domains`, async () => {
   return new Promise((resolve) => {
      resolve({
         body: JSON.stringify({ domains: [dummyDomain] }),
         status: 200,
      });
   });
});

describe('DomainHooks', () => {
   it('useFetchDomains should fetch the Domains', async () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const wrapper = ({ children }: { children: React.ReactNode }) => (
         <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
      const { result } = renderHook(() => useFetchDomains(mockRouter), { wrapper });
      // const result = { current: { isSuccess: false, data: '' } };
      await waitFor(() => {
         return expect(result.current.isLoading).toBe(false);
      });
   });
});
