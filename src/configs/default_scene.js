import { reactive } from 'vue';

const defaultScene = reactive({
    gizmo: {
        enabled: true,
        mode: 'translate',
    },
    camera: {
        position: [0, 3, 5],
        // eulerAngles: [0, 70, 0],
        eulerAngles: [-30, 0, 0],
        mode: 'fly',
        ammoDebugDrawer: {
            enabled: false,
            mode: 1,
        },
        fov: 60,
        cameraCollision:{
            radius: 1.5,
            height: 1.5,
        },
        /* flyCamera:{
            eXMax: 30,
            eXMin: -30,
        },
        lockY: true, */

    },
    // camera: {
    //     position: [0, 2.5, -8],
    //     lookat: [0, 2, 0],
    //     mode: 'orbit',
    //     distanceMax: 10,
    //     distanceMin: 1,
    //     pitchAngleMax: 60,
    //     pitchAngleMin: 0,
    // },
    data: {
        entities: {
            // hall: {
            //     type: 'gsplat',
            //     url: '/hall_low_quality.ply',
            //     // url: 'Wulanhada Volcano No.6.ply',
            //     position: [0, 2, 0],
            //     rotation: [180, 0, 0],
            //     scale: [3, 3, 3],
            //     // collision: { rigidbody: { type: 'static' } },
            // },
            // guitar1: {
            //     type: 'gsplat',
            //     url: '/guitar.splat',
            //     position: [3, 3, 0],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // guitar2: {
            //     type: 'gsplat',
            //     url: '/guitar.ply',
            //     position: [3, 3, 0],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            //     scripts: {
            //         autoRotate: {
            //             rotationSpeed: -60,
            //         }
            //     },
            // },

            // // floor: {
            // //     type: 'gsplat',
            // //     url: '/floor.splat',
            // //     position: [3, 3, 0],
            // //     rotation: [0, 0, 0],
            // //     scale: [1, 1, 1],
            // // },
            // shperetag0: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 2, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            //     // collision: {
            //     //     type: 'mesh',
            //     //     rigidbody: {
            //     //         type: 'static',
            //     //     },
            //     // },
            //     // scripts: {
            //     //     autoRotate: {
            //     //         rotationSpeed: -60,
            //     //     }
            //     // },
            // },
            // shperetag1: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 1, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // shperetag2: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 2, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // shperetag3: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 3, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // shperetag4: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 4, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // shperetag5: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 5, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // shperetag6: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 6, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // shperetag7: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 7, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // shperetag8: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 8, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // shperetag9: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 9, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // shperetag10: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 10, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // shperetag11: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 11, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // shperetag12: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 12, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // shperetag13: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 13, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // shperetag14: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 14, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // shperetag15: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 15, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // shperetag16: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 16, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // shperetag17: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 17, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // shperetag18: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 18, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },
            // shperetag19: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 19, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            // },

            // escalator: {
            //     type: 'glb',
            //     url: '/samuri.glb',
            //     position: [0, 5, 0],
            //     rotation: [0, 90, 0],
            //     scale: [3, 3, 3],
            //     scripts: {
            //         autoRotate: {
            //             rotationSpeed: -60,
            //             enabled: false,
            //         }
            //     },
            // },
            // pointer1: {
            //     type: 'glb',
            //     url: '/pointer.glb',
            //     position: [0, 1, 0],
            //     rotation: [-90, 0, 0],
            //     scale: [0.2, 0.2, 0.2],
            //     scripts: {
            //         autoRotate: {
            //             rotationSpeed: 60
            //         }
            //     },
            // },
            // pointer3: {
            //     type: 'presetObj',
            //     presetKey: 'cameraMesh',
            //     position: [1, 0, 0],
            //     rotation: [-90, 0, 0],
            //     scale: [0.2, 0.2, 0.2],
            //     scripts: {
            //         autoRotate: {
            //             rotationSpeed: 60
            //         }
            //     },
            // },
            // pointer4: {
            //     type: 'presetObj',
            //     presetKey: 'boxMesh',
            //     position: [2, 0, 2],
            //     rotation: [-90, 0, 0],
            //     scale: [0.2, 0.2, 0.2],
            //     scripts: {
            //         autoRotate: {
            //             rotationSpeed: 60
            //         }
            //     },
            // },
            // pointer5: {
            //     type: 'presetObj',
            //     presetKey: 'invisibleMesh',
            //     position: [3, 3, 3],
            //     visible: true,
            // },
            // image1: {
            //     type: 'imageSquare',
            //     width: 2,
            //     height: 1,
            //     url: '/pano.jpg',
            //     position: [3, 0, 3],
            //     scripts: {
            //         autoRotate: {
            //             rotationSpeed: 60
            //         }
            //     },
            // },

            // image2: {
            //     type: 'imageSquare',
            //     width: 100,
            //     height: 100,
            //     url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQelpKovZneHLvKFrUcNpfatYfEz4U6xPKsng&s',
            //     position: [0, 0, 0],
            //     rotation: [90, 0, 0],
            //     // transparent: true,
            //     // scripts: {
            //     //     autoRotate: {
            //     //         rotationSpeed: 60
            //     //     }
            //     // },
            //     visible: true,
            //     enabled: true,
            //     collision: {
            //         // type: 'mesh',
            //         rigidbody: {
            //             type: 'static',
            //         },
            //     }
            // },
            // mesh1: {
            //     type: 'simpleMesh',
            //     points: [
            //         [0, 0, 0],
            //         [0, 10, 0],
            //         [10, 0, 0],
            //         [10, 10, 0],
            //         [20, 0, 0],
            //         [20, 10, 0],
            //     ],
            //     position: [10, 10, 0],
            //     rotation: [10, 10, 0],
            //     color: [1, 1, 1, 0.5],
            //     scale: [1, 2, 1],
            //     mode: 'solid',
            //     visible: true,
            //     collision: {
            //         type: 'mesh',
            //         rigidbody: {
            //             type: 'static',
            //         },
            //     }
            // },
            // wall0:{
            //     type: 'simpleMesh',
            //     points: [[80.06872852233677, -10, 139.86254295532643], [80.06872852233677, 16, 139.86254295532643], [79.72508591065292, -10, 59.793814432989684], [79.72508591065292, 16, 59.793814432989684]],
            //     position: [-149, 0, -99],
            //     color: [0.6, 0.1, 0.1, 0.5],
            //     mode: 'solid',
            //     visible: true,
            //     collision: {
            //         type: 'mesh',
            //         rigidbody: {
            //             type: 'static',
            //         },
            //     },
            // }
            // building1: {
            //     projectionMapping: true,
            //     points: [
            //         // Building footprint points (arranged clockwise or counterclockwise)
            //         { x: -1, y: 0, z: -1 },
            //         { x: 1, y: 0, z: -1 },
            //         { x: 1, y: 0, z: 1 },
            //         { x: -1, y: 0, z: 1 },
            //     ],
            //     height: 2, // Building height
            //     position: [0, 0, 0],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     enabled: false,
            // }
        },
    },
    // skybox: {
    //     url: 'grey_pano.jpg',
    //     rotation: 0,
    //     position: [0, -0.5, 0],
    //     skyCenter: [0, 0.5, 0],
    //     type: 'box',
    //     // tripodY: 0.001,
    // }
});


const defaultScene_2 = reactive({
    gizmo: {
        enabled: true,
        mode: 'translate',
    },
    camera: {
        position: [0, 2.5, -8],
        // eulerAngles: [0, 70, 0],
        eulerAngles: [0, 180, 0],
        mode: 'fly',
        ammoDebugDrawer: {
            enabled: false,
            mode: 1,
        }
    },
    // camera: {
    //     position: [0, 2.5, -8],
    //     lookat: [0, 2, 0],
    //     mode: 'orbit',
    //     distanceMax: 10,
    //     distanceMin: 1,
    //     pitchAngleMax: 60,
    //     pitchAngleMin: 0,
    // },
    data: {
        entities: {
            guitar1: {
                type: 'gsplat',
                url: '/guitar.splat',
                position: [3, 3, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
                collision: { rigidbody: { type: 'dynamic' } },
            },
            guitar2: {
                type: 'gsplat',
                url: '/guitar.splat',
                position: [3, 3, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
                collision: { rigidbody: { type: 'dynamic' } },
                scripts: {
                    autoRotate: {
                        rotationSpeed: -60,
                    }
                },
            },
            // hall: {
            //     type: 'gsplat',
            //     url: '/hall_low_quality.ply',
            //     position: [0, 2, 0],
            //     rotation: [180, 0, 0],
            //     scale: [3, 3, 3],
            //     // collision: { rigidbody: { type: 'static' } },
            // },

            // floor: {
            //     type: 'gsplat',
            //     url: '/floor.splat',
            //     position: [3, 3, 0],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            // },
            // sphere: {
            //     type: 'textureSphere',
            //     url: '/pano2.jpg',
            //     position: [-1, 2, -1],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     collision: { rigidbody: { type: 'dynamic' } },
            //     scripts: {
            //         autoRotate: {
            //             rotationSpeed: -60,
            //         }
            //     },
            // },
            sphere: {
                type: 'simpleMesh',
                points: [
                    [0, 0, 0],
                    [0, 10, 0],
                    [10, 0, 0],
                    [10, 10, 0],
                    [20, 0, 0],
                    [20, 10, 0],
                ],
                position: [-1, 2, -1],
                color: [1, 1, 1, 1],
                scale: [1, 2, 1],
                mode: 'solid',
                visible: true,
                collision: {
                    type: 'mesh',
                    rigidbody: {
                        type: 'static',
                    },
                }
            },
            escalator: {
                type: 'glb',
                url: '/test.glb',
                position: [0, 5, 0],
                rotation: [0, 90, 0],
                scale: [0.001, 0.001, 0.001],
                scripts: {
                    autoRotate: {
                        rotationSpeed: -60,
                        enabled: false,
                    }
                },
            },
            pointer1: {
                type: 'glb',
                url: '/pointer.glb',
                position: [0, 1, 0],
                rotation: [-90, 0, 0],
                scale: [0.2, 0.2, 0.2],
                scripts: {
                    autoRotate: {
                        rotationSpeed: 60
                    }
                },
            },
            pointer3: {
                type: 'presetObj',
                presetKey: 'cameraMesh',
                position: [1, 0, 0],
                rotation: [-90, 0, 0],
                scale: [0.2, 0.2, 0.2],
                scripts: {
                    autoRotate: {
                        rotationSpeed: 60
                    }
                },
            },
            pointer4: {
                type: 'presetObj',
                presetKey: 'boxMesh',
                position: [2, 0, 2],
                rotation: [-90, 0, 0],
                scale: [0.2, 0.2, 0.2],
                scripts: {
                    autoRotate: {
                        rotationSpeed: 60
                    }
                },
            },
            pointer5: {
                type: 'presetObj',
                presetKey: 'invisibleMesh',
                position: [3, 3, 3],
                visible: true,
            },
            // image1: {
            //     type: 'imageSquare',
            //     width: 2,
            //     height: 1,
            //     url: '/pano.jpg',
            //     position: [3, 0, 3],
            //     scripts: {
            //         autoRotate: {
            //             rotationSpeed: 60
            //         }
            //     },
            // },

            image2: {
                type: 'imageSquare',
                width: 100,
                height: 100,
                // url: 'white.png',
                url: '/pano.jpg',
                position: [0, 0, 0],
                rotation: [90, 0, 0],
                // transparent: true,
                // scripts: {
                //     autoRotate: {
                //         rotationSpeed: 60
                //     }
                // },
                visible: true,
                enabled: true,
                collision: {
                    // type: 'mesh',
                    rigidbody: {
                        type: 'static',
                    },
                }
            },
            mesh1: {
                type: 'simpleMesh',
                points: [
                    [0, 0, 0],
                    [0, 10, 0],
                    [10, 0, 0],
                    [10, 10, 0],
                    [20, 0, 0],
                    [20, 10, 0],
                ],
                position: [10, 10, 0],
                rotation: [10, 10, 0],
                color: [1, 1, 1, 1],
                scale: [1, 2, 1],
                mode: 'solid',
                visible: true,
                collision: {
                    type: 'mesh',
                    rigidbody: {
                        type: 'static',
                    },
                }
            },
            wall0: {
                type: 'simpleMesh',
                points: [[80.06872852233677, -10, 139.86254295532643], [80.06872852233677, 16, 139.86254295532643], [79.72508591065292, -10, 59.793814432989684], [79.72508591065292, 16, 59.793814432989684]],
                position: [-149, 0, -99],
                color: [0.6, 0.1, 0.1, 1],
                mode: 'solid',
                visible: true,
                collision: {
                    type: 'mesh',
                    rigidbody: {
                        type: 'static',
                    },
                },
            }
            // building1: {
            //     projectionMapping: true,
            //     points: [
            //         // Building footprint points (arranged clockwise or counterclockwise)
            //         { x: -1, y: 0, z: -1 },
            //         { x: 1, y: 0, z: -1 },
            //         { x: 1, y: 0, z: 1 },
            //         { x: -1, y: 0, z: 1 },
            //     ],
            //     height: 2, // Building height
            //     position: [0, 0, 0],
            //     rotation: [0, 0, 0],
            //     scale: [1, 1, 1],
            //     enabled: false,
            // }
        },
    },
    skybox: {
        url: 'pano.jpg',
        rotation: 0,
        position: [0, -0.5, 0],
        skyCenter: [0, 0.5, 0],
        type: 'box',
        // tripodY: 0.001,
    }
});


const defaultScene_3 = reactive({
    gizmo: {
        enabled: false,
        mode: 'translate',
    },
    camera: {
        position: [1, 1, 1],
        lookat: [0, 0, 0],
        eulerAngles: [0, 0, 0],
        mode: 'fly',
        fov: 50,
        flyCamera: {
            eXMax: 90,
            eXMin: -90,
        },
        lockY: false,
        clearColor: [0, 0, 0, 1],
    },
    data: {
        entities: {
            mainModel: {
                type: 'gsplat',
                url: 'test2.splat',
                position: [0, 0, 0],
                rotation: [180, 0, 0],
                scale: [1, 1, 1],
                scripts: {
                    autoRotate: {
                        rotationSpeed: 0,
                    },
                },
            },
        },
    },
})


const default_scenes = [defaultScene, defaultScene_2, defaultScene_3]

export { default_scenes };