module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.+(ts|js)', '**/?(*.)+(spec|test).+(ts|js)'],
    transform: {
        '^.+\\.(js|ts)$': 'ts-jest',
    },
    moduleDirectories: ['node_modules', 'src'],
}