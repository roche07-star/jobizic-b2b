import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '오픈소스 라이선스 - Jobizic B2B',
  description: 'Jobizic B2B에서 사용하는 오픈소스 라이브러리 라이선스 정보',
};

const licenses = [
  {
    name: 'Anthropic SDK',
    version: '^0.100.1',
    license: 'Apache License 2.0',
    copyright: 'Copyright (c) 2024 Anthropic, Inc.',
    repository: 'https://github.com/anthropics/anthropic-sdk-typescript',
    description: 'AI 기반 이력서 분석 및 매칭',
    color: 'border-blue-500',
  },
  {
    name: 'Supabase Libraries',
    version: '^2.106.2',
    license: 'MIT License',
    copyright: 'Copyright (c) 2024 Supabase, Inc.',
    repository: 'https://github.com/supabase',
    description: '데이터베이스, 인증, SSR',
    color: 'border-green-500',
  },
  {
    name: 'Next.js',
    version: '16.2.6',
    license: 'MIT License',
    copyright: 'Copyright (c) 2024 Vercel, Inc.',
    repository: 'https://github.com/vercel/next.js',
    description: 'React 프레임워크',
    color: 'border-black',
  },
  {
    name: 'React',
    version: '19.2.4',
    license: 'MIT License',
    copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
    repository: 'https://github.com/facebook/react',
    description: 'UI 라이브러리',
    color: 'border-cyan-500',
  },
  {
    name: 'Mammoth.js',
    version: '^1.12.0',
    license: 'BSD 2-Clause License',
    copyright: 'Copyright (c) 2013 Michael Williamson',
    repository: 'https://github.com/mwilliamson/mammoth.js',
    description: 'DOCX 파일 파싱',
    color: 'border-orange-500',
  },
  {
    name: 'unpdf',
    version: '^1.6.2',
    license: 'MIT License',
    copyright: 'MIT License',
    repository: 'https://github.com/unjs/unpdf',
    description: 'PDF 파일 처리',
    color: 'border-red-500',
  },
  {
    name: 'Resend',
    version: '^6.12.4',
    license: 'MIT License',
    copyright: 'MIT License',
    repository: 'https://github.com/resendlabs/resend-node',
    description: '이메일 발송',
    color: 'border-purple-500',
  },
];

const licenseTexts = {
  apache: `Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`,

  mit: `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,

  bsd: `Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`,
};

export default function LicensesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900">
            오픈소스 라이선스
          </h1>
          <p className="mt-2 text-gray-600">
            Jobizic B2B는 다음 오픈소스 라이브러리를 사용하고 있습니다.
            <br />
            각 라이브러리 개발자분들께 감사드립니다. 🙏
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Libraries */}
        <div className="space-y-6">
          {licenses.map((lib, index) => (
            <div
              key={index}
              className={`bg-white border-l-4 ${lib.color} rounded-lg shadow-sm hover:shadow-md transition-shadow p-6`}
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {lib.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {lib.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800">
                      {lib.version}
                    </span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800">
                      {lib.license}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    {lib.copyright}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <a
                    href={lib.repository}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Repository
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* License Texts */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            라이선스 전문
          </h2>

          <div className="space-y-8">
            {/* Apache 2.0 */}
            <details className="bg-white rounded-lg shadow-sm border border-gray-200">
              <summary className="cursor-pointer px-6 py-4 font-semibold text-gray-900 hover:bg-gray-50 rounded-lg">
                Apache License 2.0
              </summary>
              <div className="px-6 pb-4">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded mt-4 overflow-x-auto">
                  {licenseTexts.apache}
                </pre>
              </div>
            </details>

            {/* MIT */}
            <details className="bg-white rounded-lg shadow-sm border border-gray-200">
              <summary className="cursor-pointer px-6 py-4 font-semibold text-gray-900 hover:bg-gray-50 rounded-lg">
                MIT License
              </summary>
              <div className="px-6 pb-4">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded mt-4 overflow-x-auto">
                  {licenseTexts.mit}
                </pre>
              </div>
            </details>

            {/* BSD */}
            <details className="bg-white rounded-lg shadow-sm border border-gray-200">
              <summary className="cursor-pointer px-6 py-4 font-semibold text-gray-900 hover:bg-gray-50 rounded-lg">
                BSD 2-Clause License
              </summary>
              <div className="px-6 pb-4">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded mt-4 overflow-x-auto">
                  {licenseTexts.bsd}
                </pre>
              </div>
            </details>
          </div>
        </div>

        {/* NOTICE file info */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            전체 라이선스 정보
          </h3>
          <p className="text-sm text-blue-700 mb-4">
            모든 의존성의 상세한 라이선스 정보는 NOTICE 파일을 참조하세요.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>© 2026 ROCHE. All rights reserved.</p>
          <p className="mt-2">
            Last updated: 2026-06-10
          </p>
        </div>
      </div>
    </div>
  );
}
