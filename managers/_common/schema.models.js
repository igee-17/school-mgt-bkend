const emojis = require('../../public/emojis.data.json');

module.exports = {
    id: {
        path: 'id',
        type: 'string',
        length: { min: 1, max: 50 },
    },
    username: {
        path: 'username',
        type: 'string',
        length: { min: 3, max: 20 },
        custom: 'username',
    },
    password: {
        path: 'password',
        type: 'string',
        length: { min: 8, max: 100 },
    },
    email: {
        path: 'email',
        type: 'string',
        length: { min: 3, max: 100 },
        regex: /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    },
    name: {
        path: 'name',
        type: 'string',
        length: { min: 2, max: 100 },
    },
    title: {
        path: 'title',
        type: 'string',
        length: { min: 3, max: 300 },
    },
    label: {
        path: 'label',
        type: 'string',
        length: { min: 3, max: 100 },
    },
    address: {
        path: 'address',
        type: 'string',
        length: { min: 3, max: 300 },
    },
    phone: {
        path: 'phone',
        type: 'string',
        length: { min: 7, max: 20 },
        regex: /^\+?[\d\s\-().]+$/,
    },
    capacity: {
        path: 'capacity',
        type: 'number',
        length: { min: 1, max: 1000 },
    },
    age: {
        path: 'age',
        type: 'number',
    },
    resources: {
        path: 'resources',
        type: 'string',
        length: { min: 1, max: 500 },
    },
    shortDesc: {
        path: 'desc',
        type: 'string',
        length: { min: 3, max: 300 },
    },
    longDesc: {
        path: 'desc',
        type: 'string',
        length: { min: 3, max: 2000 },
    },
    url: {
        path: 'url',
        type: 'string',
        length: { min: 9, max: 300 },
    },
    emoji: {
        path: 'emoji',
        type: 'Array',
        items: {
            type: 'string',
            length: { min: 1, max: 10 },
            oneOf: emojis.value,
        },
    },
    price: {
        path: 'price',
        type: 'number',
    },
    avatar: {
        path: 'avatar',
        type: 'string',
        length: { min: 8, max: 100 },
    },
    text: {
        type: 'String',
        length: { min: 3, max: 15 },
    },
    longText: {
        type: 'String',
        length: { min: 3, max: 250 },
    },
    paragraph: {
        type: 'String',
        length: { min: 3, max: 10000 },
    },
    number: {
        type: 'Number',
    },
    arrayOfStrings: {
        type: 'Array',
        items: {
            type: 'String',
            length: { min: 3, max: 100 },
        },
    },
    obj: {
        type: 'Object',
    },
    bool: {
        type: 'Boolean',
    },
}
