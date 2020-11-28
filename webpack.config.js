module.exports = {
    output: {
        path: __dirname,
        filename: 'dist/main.js',
        library: 'aeroweb',
    },
    externals: {
        'xml-js': 'XmlJS',
    }
}; 